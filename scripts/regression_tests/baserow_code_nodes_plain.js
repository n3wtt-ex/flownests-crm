// Code: Parse + Normalize
// Paste this into the "Code: Parse + Normalize" node (language: JavaScript, runOnceForAllItems)
function parseAndNormalizeNode(items) {
  const input = items[0].json;
  const body = input.body || input;
  const headers = input.headers || {};

  const booking = body.booking || {};
  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  const primary = attendees[0] || {};

  const idempotencyHeader =
    headers['Idempotency-Key'] ||
    headers['idempotency-key'] ||
    headers['IDEMPOTENCY-KEY'];

  const idempotency =
    body.idempotency_key || idempotencyHeader || 'cal_evt_' + Date.now();

  const normalized = {
    event: body.event || 'booking.created',
    booking: {
      id: booking.id || null,
      title: booking.title || null,
      start_time: booking.start_time || null,
      end_time: booking.end_time || null,
      attendees,
      metadata: booking.metadata || {},
    },
    idempotency_key: idempotency,
    primary_email: primary.email || null,
  };

  return [{ json: { normalized } }];
}

// Code: Build Baserow Payload (dates formatted to YYYY-MM-DD)
// Paste this into the "Code: Build Baserow Payload1" node (language: JavaScript, runOnceForAllItems)
function buildBaserowPayloadNode(items, $item) {
  const norm = $item(0, 'Code: Parse + Normalize').$json.normalized || {};
  const booking = norm.booking || {};
  const attendees = Array.isArray(booking.attendees) ? booking.attendees : [];
  const primary = attendees[0] || {};

  function toBaserowDate(value) {
    if (!value || typeof value !== 'string') return '';
    // 2025-08-05T10:00:00.000Z -> 2025-08-05
    return value.slice(0, 10);
  }

  const startDate = toBaserowDate(booking.start_time);
  const endDate = toBaserowDate(booking.end_time);

  return [
    {
      json: {
        idempotency_key: norm.idempotency_key || '',
        event: norm.event || 'booking.created',
        booking_id: booking.id || '',
        primary_email: norm.primary_email || primary.email || '',
        title: booking.title || '',
        start_time: startDate,
        end_time: endDate,
        pipeline:
          (booking.metadata && booking.metadata.pipeline) ? booking.metadata.pipeline : '',
        status: 'ok',
        created_at: new Date().toISOString(),
        raw_json: JSON.stringify(norm),
      },
    },
  ];
}

/*
USAGE in n8n Code nodes:

1) Code: Parse + Normalize
return (function(){ return parseAndNormalizeNode(items); })();

2) Code: Build Baserow Payload1
return (function(){ return buildBaserowPayloadNode(items, $item); })();

Note: Keep language=JavaScript and mode=runOnceForAllItems in both code nodes.
*/
