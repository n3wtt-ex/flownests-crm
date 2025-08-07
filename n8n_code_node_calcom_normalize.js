// n8n Code node (JavaScript) for Cal.com booking normalize
// Usage: Add a "Code" node in n8n, set Language=JavaScript, and paste this code.
// Output: next nodes can access {{$json.normalized}}

const input = items[0].json;

// In some Webhook configurations, payload is directly on $.json,
// in others it's under { headers, params, query, body }.
const body = input.body || input;
const headers = input.headers || {};

const booking = body.booking || {};
const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
const primary = attendees[0] || {};

// Prefer idempotency from body, then header, else generate one
const idempotencyHeader =
  headers['Idempotency-Key'] ||
  headers['idempotency-key'] ||
  headers['IDEMPOTENCY-KEY'];

const idempotency =
  body.idempotency_key ||
  idempotencyHeader ||
  ('cal_evt_' + Date.now());

// Normalized payload matching backend contract
const normalized = {
  event: body.event || 'booking.created',
  booking: {
    id: booking.id || null,
    title: booking.title || null,
    start_time: booking.start_time || null,
    end_time: booking.end_time || null,
    attendees: attendees,
    metadata: booking.metadata || {}
  },
  idempotency_key: idempotency,
  primary_email: primary.email || null
};

// Return as { normalized } so next nodes can use {{$json.normalized}}
return [{ normalized }];
