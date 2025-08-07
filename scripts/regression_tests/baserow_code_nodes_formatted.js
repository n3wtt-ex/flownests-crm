// Code: Parse + Normalize (unchanged logic; keeps original ISO strings from webhook)
export const parseAndNormalize = `// Normalize incoming Cal.com booking
const input = items[0].json;
const body = input.body || input;
const headers = input.headers || {};

const booking = body.booking || {};
const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
const primary = attendees[0] || {};

const idempotencyHeader = headers['Idempotency-Key'] || headers['idempotency-key'] || headers['IDEMPOTENCY-KEY'];
const idempotency = body.idempotency_key || idempotencyHeader || ('cal_evt_' + Date.now());

const normalized = {
  event: body.event || 'booking.created',
  booking: {
    id: booking.id || null,
    title: booking.title || null,
    start_time: booking.start_time || null,
    end_time: booking.end_time || null,
    attendees,
    metadata: booking.metadata || {}
  },
  idempotency_key: idempotency,
  primary_email: primary.email || null
};

return [{ normalized }];`;

// Code: Build Baserow Payload (formatted to Baserow date format: YYYY-MM-DD or Z-less ISO if needed)
// This trims the time part by taking only the date portion (YYYY-MM-DD).
export const buildBaserowPayload = `// Build payload for Baserow from normalized (format dates as YYYY-MM-DD)
const norm = $item(0, 'Code: Parse + Normalize').$json.normalized || {};
const booking = norm.booking || {};
const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
const primary = attendees[0] || {};

// Helper: format to YYYY-MM-DD if ISO string, else return as-is or empty
function toBaserowDate(value) {
  if (!value || typeof value !== 'string') return '';
  // If it's ISO like 2025-08-05T10:00:00.000Z -> take first 10 chars
  // If it's already YYYY-MM-DD -> remains as is
  return value.slice(0, 10);
}

const startDate = toBaserowDate(booking.start_time);
const endDate = toBaserowDate(booking.end_time);

return [{
  idempotency_key: norm.idempotency_key || '',
  event: norm.event || 'booking.created',
  booking_id: booking.id || '',
  primary_email: norm.primary_email || primary.email || '',
  title: booking.title || '',
  start_time: startDate,
  end_time: endDate,
  pipeline: (booking.metadata && booking.metadata.pipeline) ? booking.metadata.pipeline : '',
  status: 'ok',
  created_at: new Date().toISOString(),
  raw_json: JSON.stringify(norm)
}];`;
