#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api/v1}"
SECRET="${HUSTLE_SANDBOX_WEBHOOK_SECRET:-}"

usage() {
  cat <<'EOF'
Usage:
  HUSTLE_SANDBOX_WEBHOOK_SECRET=... ./scripts/phase13-sandbox-event.sh \
    <event-type> <provider-reference> <amount-minor> <currency> [event-id] [failure-code] [failure-reason]

Supported event types:
  payment.succeeded
  payment.failed
  payout.succeeded
  payout.failed
  refund.succeeded
  refund.failed

The helper signs the canonical sandbox payload locally and prints only the JSON response.
It never prints the webhook secret.
EOF
}

if [[ $# -lt 4 ]]; then
  usage
  exit 2
fi

if [[ -z "$SECRET" ]]; then
  echo "HUSTLE_SANDBOX_WEBHOOK_SECRET must be set in the shell." >&2
  exit 2
fi

for command in curl jq openssl; do
  command -v "$command" >/dev/null 2>&1 || {
    echo "$command is required." >&2
    exit 2
  }
done

EVENT_TYPE="$1"
REFERENCE="$2"
AMOUNT_MINOR="$3"
CURRENCY="${4^^}"
EVENT_ID="${5:-evt-$(date +%s)-$(openssl rand -hex 6)}"
FAILURE_CODE="${6:-}"
FAILURE_REASON="${7:-}"

case "$EVENT_TYPE" in
  payment.succeeded|payment.failed)
    ENDPOINT="$API_BASE/payments/webhooks/sandbox"
    ;;
  payout.succeeded|payout.failed|refund.succeeded|refund.failed)
    ENDPOINT="$API_BASE/payments/webhooks/sandbox-operations"
    ;;
  *)
    echo "Unsupported event type: $EVENT_TYPE" >&2
    usage
    exit 2
    ;;
esac

if ! [[ "$AMOUNT_MINOR" =~ ^[1-9][0-9]*$ ]]; then
  echo "amount-minor must be a positive integer." >&2
  exit 2
fi

CANONICAL="${EVENT_ID}|${EVENT_TYPE}|${REFERENCE}|${AMOUNT_MINOR}|${CURRENCY}|${FAILURE_CODE}|${FAILURE_REASON}"
SIGNATURE="$(printf '%s' "$CANONICAL" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')"

PAYLOAD="$(
  jq -nc \
    --arg eventId "$EVENT_ID" \
    --arg type "$EVENT_TYPE" \
    --arg reference "$REFERENCE" \
    --argjson amountMinor "$AMOUNT_MINOR" \
    --arg currency "$CURRENCY" \
    --arg failureCode "$FAILURE_CODE" \
    --arg failureReason "$FAILURE_REASON" \
    '{
      eventId: $eventId,
      type: $type,
      reference: $reference,
      amountMinor: $amountMinor,
      currency: $currency
    }
    + (if $failureCode == "" then {} else {failureCode: $failureCode} end)
    + (if $failureReason == "" then {} else {failureReason: $failureReason} end)'
)"

curl -sS -X POST \
  -H "Content-Type: application/json" \
  -H "x-hustle-sandbox-signature: $SIGNATURE" \
  "$ENDPOINT" \
  -d "$PAYLOAD" | jq
