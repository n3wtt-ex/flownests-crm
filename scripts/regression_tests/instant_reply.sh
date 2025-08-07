#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://127.0.0.1:8000}"
IDEMPOTENCY_KEY="${2:-evt_pg_010}"
SIGNATURE_HEADER_NAME="${3:-X-Signature}"
SIGNATURE_VALUE="${4:-REPLACE_WITH_VALID_SIGNATURE_OR_USE_DEV_BYPASS_FALSE_AND_REAL_SIGN}"

PAYLOAD='{
  "event": "reply",
  "campaign_id": "cmp_789",
  "lead": {
    "email": "mike@globex.com",
    "full_name": "Mike Neo",
    "website": "https://globex.example"
  },
  "message": {
    "text": "pricing details?",
    "subject": "Re: Intro",
    "received_at": "2025-08-05T10:00:00Z"
  },
  "idempotency_key": "'"$IDEMPOTENCY_KEY"'"
}'

echo "POST URL: $URL"
echo "Idempotency-Key: $IDEMPOTENCY_KEY"
echo "Signature header: $SIGNATURE_HEADER_NAME: $SIGNATURE_VALUE"
echo "Payload: $PAYLOAD"
echo

# First POST (expect 200)
echo "== First POST (expect 200) =="
HTTP_CODE_1=$(
  curl -sS -o /tmp/resp1.json -w "%{http_code}" \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
    -H "$SIGNATURE_HEADER_NAME: $SIGNATURE_VALUE" \
    --data "$PAYLOAD"
)
echo "Status: $HTTP_CODE_1"
echo "Body:"
cat /tmp/resp1.json
echo
echo

# Second POST (expect 409)
echo "== Second POST (expect 409) =="
HTTP_CODE_2=$(
  curl -sS -o /tmp/resp2.json -w "%{http_code}" \
    -X POST "$URL" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
    -H "$SIGNATURE_HEADER_NAME: $SIGNATURE_VALUE" \
    --data "$PAYLOAD"
)
echo "Status: $HTTP_CODE_2"
echo "Body:"
cat /tmp/resp2.json
echo

# Exit with non-zero if expectations not met
EXIT_CODE=0
if [[ "$HTTP_CODE_1" != "200" ]]; then
  echo "ERROR: First POST expected 200, got $HTTP_CODE_1" >&2
  EXIT_CODE=1
fi
if [[ "$HTTP_CODE_2" != "409" ]]; then
  echo "ERROR: Second POST expected 409, got $HTTP_CODE_2" >&2
  EXIT_CODE=1
fi
exit $EXIT_CODE
