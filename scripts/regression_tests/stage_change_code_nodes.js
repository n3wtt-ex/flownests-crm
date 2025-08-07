// n8n Code node JavaScript snippets for crm_stage_change_outbound
// Copy-paste each block into the respective Code node (Verify Secret Header, Extract Payload, Logger)
// Then run your webhook tests. You can delete this file afterwards.

// 1) Verify Secret Header (Node name: "Verify Secret Header")
export const VERIFY_SECRET_JS = `
// Verify X-CRM-Secret header against env
const headers = $json.headers || {};
// Normalize header keys to be safe across proxies/casing
const norm = Object.fromEntries(Object.entries(headers).map(([k,v]) => [String(k).toLowerCase(), v]));
const secret = norm["x-crm-secret"];

if (!secret) {
  return [{ authorized: false, status: 401, error: "missing X-CRM-Secret" }];
}

const expected = $env.CRM_OUTBOUND_SECRET || "";
if (!expected) {
  // Optional: return 500-ish info to indicate misconfig (keep authorized=false)
  return [{ authorized: false, status: 500, error: "CRM_OUTBOUND_SECRET not configured" }];
}

if (secret !== expected) {
  return [{ authorized: false, status: 403, error: "invalid X-CRM-Secret" }];
}

return [{ authorized: true }];
`.trim();


// 2) Extract Payload (Node name: "Extract Payload")
export const EXTRACT_PAYLOAD_JS = `
// Extract primary body fields for downstream use
const body = $json.body || $json;

// Defensive parsing: accept both snake_case and potential camelCase variants if any
const deal_id = body.deal_id ?? body.dealId ?? null;
const old_stage_id = body.old_stage_id ?? body.oldStageId ?? null;
const new_stage_id = body.new_stage_id ?? body.newStageId ?? null;
const occurred_at = body.occurred_at ?? body.occurredAt ?? null;
const source = body.source ?? "crm-ui";

return [{
  deal_id,
  old_stage_id,
  new_stage_id,
  occurred_at,
  source
}];
`.trim();


// 3) Logger (Node name: "Logger")
export const LOGGER_JS = `
// Default log-only branch
const msg = \`Stage change logged for deal \${$json.deal_id} -> \${$json.new_stage_id}\`;
console.log(msg);
return [{ message: msg }];
`.trim();


// 4) Switch node configuration (for "Switch: Not Interested?" node)
// Use these values in the Switch node UI:
// - Value 1: ={{$json.new_stage_id || ''}}
// - Rules:
//   1) type: value, operation: contains, value2: not_interested, output: 1
//   2) type: value, operation: contains, value2: NOT_INTERESTED, output: 1
// Meaning:
// - If new_stage_id contains "not_interested" (case-insensitive option by adding two rules), route to output #1 (e.g., Instantly Remove Lead - mock).
// - Otherwise, route to default output (0) which goes to Logger + Respond 200.

// 5) Optional quick test payload (use in your client):
// {
//   "id": "evt_dev_001",
//   "type": "deal_stage_changed",
//   "deal_id": "deal-uuid-test",
//   "old_stage_id": "old-stage-uuid",
//   "new_stage_id": "not_interested",
//   "occurred_at": "2025-08-06T10:00:00.000Z",
//   "source": "crm-ui",
//   "idempotency_key": "move_dev_001"
// }

// 6) Headers for authorized call:
//   X-CRM-Secret: <YOUR_SECRET>
//   Content-Type: application/json

// 7) Notes:
// - Verify Secret Header now lowercases headers to avoid casing issues.
// - Extract Payload accepts both snake_case and camelCase keys safely.
// - Logger prints to execution log and returns a message field.
