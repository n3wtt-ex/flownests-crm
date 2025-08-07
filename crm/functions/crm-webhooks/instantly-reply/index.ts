/**
 * DEV step-by-step handler
 * - Step A: memory idempotency
 * - Step B: contacts upsert(email)
 * REST: POST /crm/webhooks/instantly/reply
 */
import { jsonResponse } from "./_utils.ts";
import type { InstantlyReplyPayload } from "./_types.ts";
// Direct Postgres connection for DEV (bypasses Supabase HTTP/JWS layer)
import { Client } from "https://deno.land/x/postgres@v0.17.2/mod.ts";

declare const Deno: {
  env: { get: (k: string) => string | undefined };
  serve: (h: (req: Request) => Response | Promise<Response>) => void;
};

// In-memory idempotency store (DEV only; resets on server restart)
const seen = new Map<string, number>();

export async function handler(req: Request) {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method Not Allowed" }, 405);
  }

  // Read raw body and parse JSON
  const raw = await req.text();
  let payload: InstantlyReplyPayload;
  try {
    payload = raw ? JSON.parse(raw) : ({} as any);
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  // HMAC signature verification (required in prod/staging)
  // DEV_SIGNATURE_BYPASS defaults to false (require signature)
  const DEV_SIGNATURE_BYPASS = (Deno.env.get("DEV_SIGNATURE_BYPASS") ?? "false").toLowerCase() === "true";
  const HMAC_SECRET = Deno.env.get("HMAC_SHARED_SECRET_INSTANTLY") ?? "";
  const SIGNATURE_HEADER = req.headers.get("X-Signature") ?? "";
  if (!DEV_SIGNATURE_BYPASS) {
    if (!HMAC_SECRET) {
      return jsonResponse({ error: "hmac_secret_missing" }, 500);
    }
    if (!SIGNATURE_HEADER) {
      return jsonResponse({ error: "signature_missing" }, 401);
    }
    // Compute HMAC-SHA256 over raw body with shared secret, compare hex (case-insensitive)
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(HMAC_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(raw));
    const hex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
    const provided = SIGNATURE_HEADER.trim().toLowerCase();
    const expected = hex.toLowerCase();

    if (provided !== expected) {
      // Avoid leaking expected value in logs; provide short debug info
      console.warn("[instantly-reply] HMAC mismatch", {
        provided_len: provided.length,
        expected_len: expected.length,
      });
      return jsonResponse({ error: "signature_invalid" }, 403);
    }
  }

  // Step A (DEV): memory-based idempotency
  const idempotencyKey =
    req.headers.get("Idempotency-Key") ||
    (typeof payload === "object" && payload && (payload as any).idempotency_key) ||
    null;

  const key = idempotencyKey ?? `no-key:${crypto.randomUUID()}`;
  if (seen.has(key)) {
    return jsonResponse({ error: "Duplicate event (memory idempotency)" }, 409);
  }
  seen.set(key, Date.now());

  // Step B: contacts upsert by email
  const email = (payload as any)?.lead?.email?.toLowerCase?.();
  if (!email) {
    return jsonResponse({ error: "Missing lead.email" }, 400);
  }

  // PG connection params from env
  const PG_HOST = Deno.env.get("PG_HOST") ?? "localhost";
  const PG_PORT = Number(Deno.env.get("PG_PORT") ?? "5432");
  const PG_DATABASE = Deno.env.get("PG_DATABASE") ?? "postgres";
  const PG_USER = Deno.env.get("PG_USER") ?? "postgres";
  const PG_PASSWORD = Deno.env.get("PG_PASSWORD") ?? "";

  if (!PG_HOST || !PG_PORT || !PG_DATABASE || !PG_USER) {
    return jsonResponse({ error: "pg_env_missing" }, 500);
  }

  const client = new Client({
    hostname: PG_HOST,
    port: PG_PORT,
    database: PG_DATABASE,
    user: PG_USER,
    password: PG_PASSWORD,
  });

  try {
    await client.connect();

// Schema creation moved to migrations (crm/sql). Runtime DDL removed.

    // Upsert contact (email unique)
    const fullName = (payload as any)?.lead?.full_name ?? null;
    const website = (payload as any)?.lead?.website ?? null;
    const linkedin = (payload as any)?.lead?.linkedin_url ?? null;

    const upsertSql = `
      INSERT INTO public.contacts (email, full_name, website, linkedin_url, updated_at)
      VALUES ($1, $2, $3, $4, now())
      ON CONFLICT (email)
      DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, public.contacts.full_name),
        website = COALESCE(EXCLUDED.website, public.contacts.website),
        linkedin_url = COALESCE(EXCLUDED.linkedin_url, public.contacts.linkedin_url),
        updated_at = now()
      RETURNING id;
    `;
    const res = await client.queryObject<{ id: string }>(upsertSql, email, fullName, website, linkedin);
    const contactId = res.rows?.[0]?.id;
    if (!contactId) {
      return jsonResponse({ error: "contacts_upsert_failed: no id returned" }, 500);
    }

    // Step C: insert activity (email_in)
    const activityContent =
      (payload as any)?.message?.snippet ||
      (payload as any)?.message?.subject ||
      "Email reply";
    const meta = {
      campaign_id: (payload as any)?.campaign_id ?? null,
      message_subject: (payload as any)?.message?.subject ?? null,
      message_text: (payload as any)?.message?.text ?? null,
      received_at: (payload as any)?.message?.received_at ?? null,
      idempotency_key: idempotencyKey ?? null,
    };
    // DEBUG: ensure UUID and JSON param ordering are correct
    console.log("[instantly-reply] DEBUG contactId(refetched):", contactId);
    const metaStr = JSON.stringify(meta);
    console.log("[instantly-reply] DEBUG meta(head):", metaStr.slice(0, 80));
    console.log("[instantly-reply] DEBUG typeof contactId:", typeof contactId, contactId);
    console.log("[instantly-reply] DEBUG bind preview:", JSON.stringify(["email_in","contact","<uuid>", activityContent.slice(0,20), "<json>"]));

    const actSql = `
      INSERT INTO public.activities (type, related_type, related_id, content, meta_json)
      SELECT $1::text, $2::text, $3::uuid, $4::text, $5::jsonb
      RETURNING id;
    `;
    const actCfg = {
      text: actSql,
      args: ["email_in", "contact", contactId, activityContent, metaStr],
    };
    const actRes = await client.queryObject<{ id: string }>(actCfg);
    const activityId = actRes.rows?.[0]?.id;

    // Step D: mock intent update on contact
    const text = String(((payload as any)?.message?.text ?? "") as string).toLowerCase();
    let reply_status: "interested" | "not_interested" | "question" = "interested";
    let reply_summary = "Lead replied positively (mock).";
    if (text.includes("price") || text.includes("pricing")) {
      reply_status = "interested";
      reply_summary = "Lead asked about pricing.";
    } else if (text.includes("?")) {
      reply_status = "question";
      reply_summary = "Lead asked a question.";
    }
    const updSql = `
      UPDATE public.contacts
      SET reply_status = $1::text, reply_summary = $2::text, updated_at = now()
      WHERE id = $3::uuid
      RETURNING id;
    `;
    const updCfg = {
      text: updSql,
      args: [reply_status, reply_summary, contactId],
    };
    await client.queryObject(updCfg);

    // Step E: ensure deal exists on current CRM schema (pipelines/stages)
    // 1) Resolve default pipeline_id
    const defPipeRes = await client.queryObject<{ id: string }>(
      { text: `select id from pipelines where is_default = true order by created_at asc limit 1` },
    );
    const pipelineId = defPipeRes.rows?.[0]?.id ?? null;
    if (!pipelineId) {
      return jsonResponse({ error: "pipeline_not_found_default" }, 500);
    }

    // 2) Resolve 'New' stage_id for that pipeline (seed uses 'New' with capital N)
    const stageRes = await client.queryObject<{ id: string }>(
      { text: `select id from pipeline_stages where pipeline_id = $1::uuid and name = 'New' limit 1`, args: [pipelineId] },
    );
    const stageId = stageRes.rows?.[0]?.id ?? null;
    if (!stageId) {
      return jsonResponse({ error: "stage_not_found_new" }, 500);
    }

    // 3) Upsert deal by (contact_id, stage_id)
    const emailForTitle = email;
    const dealTitle = `Instantly Reply – ${emailForTitle}`;
    const dealSql = `
      insert into deals (contact_id, pipeline_id, stage_id, title, amount, status, updated_at)
      values ($1::uuid, $2::uuid, $3::uuid, $4::text, null, 'open', now())
      on conflict (contact_id, stage_id)
      do update set title = excluded.title, updated_at = now()
      returning id;
    `;
    const dealCfg = { text: dealSql, args: [contactId, pipelineId, stageId, dealTitle] };
    const dealRes = await client.queryObject<{ id: string }>(dealCfg);
    const dealId = dealRes.rows?.[0]?.id ?? null;

    // Insert a system note activity for the deal
    let systemActivityId: string | null = null;
    if (dealId) {
      const sysNote = "Created from Instantly reply";
      const sysMeta = {
        source: "instantly-reply-webhook",
        created_from_contact_id: contactId,
        idempotency_key: idempotencyKey ?? null,
      };
      const sysSql = `
        INSERT INTO public.activities (type, related_type, related_id, content, meta_json)
        SELECT $1::text, $2::text, $3::uuid, $4::text, $5::jsonb
        RETURNING id;
      `;
      const sysCfg = { text: sysSql, args: ["system_note", "deal", dealId, sysNote, JSON.stringify(sysMeta)] };
      const sysRes = await client.queryObject<{ id: string }>(sysCfg);
      systemActivityId = sysRes.rows?.[0]?.id ?? null;
    }

    // Step F (dev logging): webhooks_log_dev
    try {
      await client.queryObject`
        CREATE TABLE IF NOT EXISTS public.webhooks_log_dev (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          source text,
          idempotency_key text,
          payload jsonb,
          created_at timestamptz DEFAULT now()
        );
      `;
      const logSql = `
        INSERT INTO public.webhooks_log_dev (source, idempotency_key, payload)
        SELECT $1::text, $2::text, $3::jsonb;
      `;
      const logCfg = { text: logSql, args: ["instantly.reply", idempotencyKey ?? null, raw] };
      await client.queryObject(logCfg);
    } catch (_e) {
      // swallow dev log errors
    }

    return jsonResponse(
      {
        status: "ok",
        step: "E:deal_created_and_logged",
        idempotency_key: idempotencyKey ?? null,
        contact_id: contactId,
        activity_id: activityId ?? null,
        reply_status,
        reply_summary,
        deal_id: dealId,
        system_activity_id: systemActivityId,
      },
      200,
    );
  } catch (e) {
    return jsonResponse({ error: `pg_flow_failed: ${e?.message || "unknown"}` }, 500);
  } finally {
    try {
      await client.end();
    } catch {}
  }
}

export default handler;
