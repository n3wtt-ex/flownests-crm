/**
 * Supabase Edge Function: CRM Actions
 * Endpoints:
 *  - POST /crm/actions/deals           -> create/update deal
 *  - POST /crm/actions/deals/:id/stage -> update deal stage (Kanban DnD)
 *  - POST /crm/actions/contacts       -> create/update contact
 *
 * Auth: Bearer JWT (Supabase Auth). RLS uygulanır. Server-side için service key kullanılabilir.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: { get: (k: string) => string | undefined };
};

type Json = Record<string, any>;

function getEnvOrThrow(key: string): string {
  const v = Deno?.env?.get?.(key);
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

async function parseJson(req: Request): Promise<any> {
  const raw = await req.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw new Error("Invalid JSON");
  }
}

/**
 * Route matching helper for /crm/actions/deals/:id/stage
 */
function matchDealsStagePath(url: URL): { ok: boolean; dealId?: string } {
  // Expected path: /crm/actions/deals/:id/stage
  const path = url.pathname.replace(/^\/functions\/v1/, ""); // supabase local prefix toleransı
  const parts = path.split("/").filter(Boolean);
  // ["crm","actions","deals",":id","stage"]
  if (parts.length === 5 && parts[0] === "crm" && parts[1] === "actions" && parts[2] === "deals" && parts[4] === "stage") {
    return { ok: true, dealId: parts[3] };
  }
  return { ok: false };
}

Deno.serve(async (req: Request) => {
  try {
    const method = req.method.toUpperCase();
    if (method !== "POST") return jsonResponse({ error: "Method Not Allowed" }, 405);

    const SUPABASE_URL = getEnvOrThrow("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY"); // optional for client-RLS
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); // optional for server-side ops

    // Prefer Bearer token from client to respect RLS; fallback to service role if needed
    const authHeader = req.headers.get("Authorization") || "";
    const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
    const supabase = createClient(
      SUPABASE_URL,
      bearerToken || SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY || "",
      { auth: { persistSession: false } }
    );

    const url = new URL(req.url);

    // Route: /crm/actions/deals/:id/stage
    const match = matchDealsStagePath(url);
    if (match.ok && match.dealId) {
      const body = await parseJson(req);
      const stage_id: string | undefined = body?.stage_id;
      if (!stage_id) return jsonResponse({ error: "stage_id is required" }, 400);

      // Update deal stage
      const { data: existing, error: getErr } = await supabase
        .from("deals")
        .select("id, stage_id")
        .eq("id", match.dealId)
        .single();
      if (getErr) return jsonResponse({ error: getErr.message }, 404);

      const old_stage_id = existing.stage_id;

      const { error: updErr } = await supabase
        .from("deals")
        .update({ stage_id })
        .eq("id", match.dealId);
      if (updErr) return jsonResponse({ error: updErr.message }, 403);

      // Log activity (system)
      await supabase.from("activities").insert({
        type: "system",
        related_type: "deal",
        related_id: match.dealId,
        content: `Stage changed ${old_stage_id} -> ${stage_id}`,
        meta_json: { source: "crm-ui" },
      });

      // Outbound webhook (Sprint 1: just log; Sprint 2: real send)
      await supabase.from("webhooks_log").insert({
        source: "crm-ui",
        event_type: "deal_stage_changed",
        payload_json: {
          deal_id: match.dealId,
          old_stage_id,
          new_stage_id: stage_id,
          occurred_at: new Date().toISOString(),
          source: "crm-ui",
        },
        status: "processed",
      });

      return jsonResponse({ status: "ok", id: match.dealId, stage_id });
    }

    // Route: /crm/actions/deals (create/update)
    if (url.pathname.endsWith("/crm/actions/deals")) {
      const body = await parseJson(req);
      const id: string | undefined = body?.id;

      if (id) {
        // Update
        const payload: Json = {};
        for (const k of ["title","stage_id","pipeline_id","amount","currency","close_date","status","source","notes","company_id","contact_id"]) {
          if (body[k] !== undefined) payload[k] = body[k];
        }
        const { error: updErr } = await supabase.from("deals").update(payload).eq("id", id);
        if (updErr) return jsonResponse({ error: updErr.message }, 403);
        return jsonResponse({ status: "ok", id });
      } else {
        // Create
        for (const field of ["title","pipeline_id","stage_id"]) {
          if (!body[field]) return jsonResponse({ error: `Missing field: ${field}` }, 400);
        }
        const { data: rec, error: insErr } = await supabase
          .from("deals")
          .insert({
            title: body.title,
            contact_id: body.contact_id ?? null,
            company_id: body.company_id ?? null,
            pipeline_id: body.pipeline_id,
            stage_id: body.stage_id,
            amount: body.amount ?? null,
            currency: body.currency ?? "USD",
            close_date: body.close_date ?? null,
            status: body.status ?? "open",
            source: body.source ?? "inbound",
            notes: body.notes ?? null,
          })
          .select()
          .single();
        if (insErr) return jsonResponse({ error: insErr.message }, 403);
        return jsonResponse({ status: "ok", id: rec.id });
      }
    }

    // Route: /crm/actions/contacts (create/update)
    if (url.pathname.endsWith("/crm/actions/contacts")) {
      const body = await parseJson(req);
      const id: string | undefined = body?.id;

      if (id) {
        // Update
        const payload: Json = {};
        for (const k of ["full_name","title","company_id","owner_id","lifecycle_stage","reply_status","reply_summary","website","linkedin_url","phone"]) {
          if (body[k] !== undefined) payload[k] = body[k];
        }
        const { error: updErr } = await supabase.from("contacts").update(payload).eq("id", id);
        if (updErr) return jsonResponse({ error: updErr.message }, 403);
        return jsonResponse({ status: "ok", id });
      } else {
        // Create
        if (!body.email) return jsonResponse({ error: "Missing field: email" }, 400);
        const { data: rec, error: insErr } = await supabase
          .from("contacts")
          .insert({
            email: body.email,
            full_name: body.full_name ?? null,
            title: body.title ?? null,
            company_id: body.company_id ?? null,
            owner_id: body.owner_id ?? null,
            lifecycle_stage: body.lifecycle_stage ?? "lead",
            website: body.website ?? null,
            linkedin_url: body.linkedin_url ?? null,
            phone: body.phone ?? null,
          })
          .select()
          .single();
        if (insErr) return jsonResponse({ error: insErr.message }, 403);
        return jsonResponse({ status: "ok", id: rec.id });
      }
    }

    return jsonResponse({ error: "Not Found" }, 404);
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Internal Error" }, 500);
  }
});
