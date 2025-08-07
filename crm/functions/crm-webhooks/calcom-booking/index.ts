/**
 * Supabase Edge Function: POST /crm/webhooks/calcom/booking
 * Purpose: Ingest cal.com booking webhooks, relate to contact/deal, set stage to "Meeting Scheduled", log activity.
 * Security: HMAC-SHA256 signature (X-Signature) - can be bypassed in dev via DEV_SIGNATURE_BYPASS.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verifyHmacSignature, parseJson, getIdempotencyKey, jsonResponse, getEnvOrThrow } from "./_utils.ts";
import type { CalcomBookingPayload } from "./_types.ts";

declare const Deno: {
  env: { get: (k: string) => string | undefined };
};

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Method Not Allowed" }, 405);
    }

    const SUPABASE_URL = getEnvOrThrow("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY");
    const DEV_SIGNATURE_BYPASS = Deno.env.get("DEV_SIGNATURE_BYPASS") === "true";
    const HMAC_SHARED_SECRET_CALCOM = Deno.env.get("HMAC_SHARED_SECRET_CALCOM") || "";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // read raw + json
    const { raw, json } = await parseJson(req);
    const payload = json as CalcomBookingPayload;

    // signature verification (optional in dev)
    const signatureHeader = req.headers.get("X-Signature") ?? "";
    if (!DEV_SIGNATURE_BYPASS) {
      const ok = await verifyHmacSignature(raw, signatureHeader, HMAC_SHARED_SECRET_CALCOM);
      if (!ok) {
        return jsonResponse({ error: "Invalid signature" }, 401);
      }
    }

    const idempotencyKey = getIdempotencyKey(req.headers, payload?.idempotency_key);

    // log webhook (received)
    const { data: logRec, error: logErr } = await supabase
      .from("webhooks_log")
      .insert({
        source: "cal.com",
        event_type: payload?.event ?? "booking.created",
        idempotency_key: idempotencyKey,
        payload_json: payload,
        status: "received",
      })
      .select()
      .single();

    if (logErr && logErr.code !== "23505") {
      throw logErr;
    }
    if (logErr && logErr.code === "23505") {
      return jsonResponse({ error: "Duplicate event" }, 409);
    }

    // find attendee email (first)
    const attendeeEmail =
      payload?.booking?.attendees?.[0]?.email?.toLowerCase() ||
      payload?.attendees?.[0]?.email?.toLowerCase();
    if (!attendeeEmail) {
      throw new Error("Missing attendee email");
    }

    // upsert contact by email (be tolerant)
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .upsert(
        {
          email: attendeeEmail,
          full_name: payload?.booking?.attendees?.[0]?.name ?? null,
        },
        { onConflict: "email" }
      )
      .select()
      .single();
    if (contactErr) throw contactErr;

    // ensure meeting stage id
    const { data: pipeline, error: pipErr } = await supabase
      .from("pipelines")
      .select("id")
      .eq("is_default", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();
    if (pipErr) throw pipErr;

    const { data: meetingStage, error: stageErr } = await supabase
      .from("pipeline_stages")
      .select("id")
      .eq("pipeline_id", pipeline.id)
      .eq("name", "Meeting Scheduled")
      .limit(1)
      .single();
    if (stageErr) throw stageErr;

    // try to find an open deal for this contact
    let dealId: string | null = null;
    const { data: openDeals, error: openErr } = await supabase
      .from("deals")
      .select("id")
      .eq("contact_id", contact.id)
      .eq("status", "open")
      .limit(1);
    if (openErr) throw openErr;

    if (openDeals && openDeals.length > 0) {
      dealId = openDeals[0].id;
      // update stage to Meeting Scheduled
      const { error: updDealErr } = await supabase
        .from("deals")
        .update({ stage_id: meetingStage.id })
        .eq("id", dealId);
      if (updDealErr) throw updDealErr;
    } else {
      // create new deal directly in Meeting Scheduled
      const { data: newDeal, error: dealErr } = await supabase
        .from("deals")
        .insert({
          title: `${contact.full_name || contact.email} - Meeting`,
          contact_id: contact.id,
          company_id: contact.company_id ?? null,
          pipeline_id: pipeline.id,
          stage_id: meetingStage.id,
          status: "open",
          source: "inbound",
          notes: "Created by cal.com booking webhook.",
        })
        .select()
        .single();
      if (dealErr) throw dealErr;
      dealId = newDeal.id;
    }

    // create meeting activity
    const booking = payload?.booking;
    const content = `Meeting scheduled: ${booking?.title || "Call"} (${booking?.start_time} - ${booking?.end_time})`;
    const { error: actErr } = await supabase.from("activities").insert({
      type: "meeting",
      related_type: "deal",
      related_id: dealId,
      content,
      meta_json: {
        booking_id: booking?.id,
        attendees: booking?.attendees,
        start_time: booking?.start_time,
        end_time: booking?.end_time,
      },
    });
    if (actErr) throw actErr;

    // finalize webhook log
    await supabase
      .from("webhooks_log")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("id", logRec?.id);

    return jsonResponse({
      status: "ok",
      contact_id: contact.id,
      deal_id: dealId,
    });
  } catch (err: any) {
    return jsonResponse({ error: err?.message || "Internal Error" }, 500);
  }
});
