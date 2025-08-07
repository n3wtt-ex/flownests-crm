// Code: Build Baserow Payload1 (minimal patch)
// Only trims milliseconds to match '...Z' format like: 2025-08-01T08:47:01Z
// Paste entire content into the "Code: Build Baserow Payload1" node.

const norm = $item(0, 'Code: Parse + Normalize').$json.normalized || {};
const booking = norm.booking || {};
const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
const primary = attendees[0] || {};

// Keep original ISO but remove milliseconds: "2025-08-05T10:00:00.000Z" -> "2025-08-05T10:00:00Z"
function trimMs(iso) {
  if (!iso || typeof iso !== 'string') return '';
  // If it already has no milliseconds just return as is
  // Else replace ".sssZ" with "Z"
  return iso.replace(/\.\d{3}Z$/, 'Z');
}

const start_time = trimMs(booking.start_time);
const end_time = trimMs(booking.end_time);

return [{
  idempotency_key: norm.idempotency_key || '',
  event: norm.event || 'booking.created',
  booking_id: booking.id || '',
  primary_email: norm.primary_email || primary.email || '',
  title: booking.title || '',
  start_time,
  end_time,
  pipeline: (booking.metadata && booking.metadata.pipeline) ? booking.metadata.pipeline : '',
  status: 'ok',
  created_at: new Date().toISOString(),
  raw_json: JSON.stringify(norm)
}];
