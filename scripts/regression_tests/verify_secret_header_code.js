/**
 * n8n Code node snippet for "Verify Secret Header"
 * Usage: Open the Code node (JavaScript, runOnceForAllItems), delete existing content,
 *        and paste ONLY the function body below into the JS Code area (without this comment).
 * This snippet DOES NOT return HTTP 200 itself; it only emits authorized info.
 * 200 is returned by your downstream "Respond 200" node when IF Authorized? is true.
 */

// --- BEGIN: PASTE INTO n8n CODE NODE ---

// Verify X-CRM-Secret header against fixed value (no env required)
const headers = $json.headers || {};

// Normalize header keys to be safe across proxies/casing
const norm = Object.fromEntries(
  Object.entries(headers).map(([k, v]) => [String(k).toLowerCase(), v])
);

// Incoming secret (lowercased header)
const secret = norm["x-crm-secret"];

// FIXED SECRET (put your own secret here)
const expected = "25f0b07e-8b77-4a7d-a9bb-5c9c359f9e8d";

// Reserved-key-safe output (wrap everything under "result")
if (!secret) {
  return [{ result: { authorized: false, status: 401, reason: "missing X-CRM-Secret" } }];
}

if (secret !== expected) {
  return [{ result: { authorized: false, status: 403, reason: "invalid X-CRM-Secret" } }];
}

// Authorized true -> IF node will route to Extract → Logger → Respond 200
return [{ result: { authorized: true } }];

// --- END: PASTE INTO n8n CODE NODE ---
