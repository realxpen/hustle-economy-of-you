#!/usr/bin/env bash
set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api/v1}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"
XPEN_TOKEN="${XPEN_TOKEN:-}"
SECRET="${HUSTLE_SANDBOX_WEBHOOK_SECRET:-}"
BOOKING_ID="${BOOKING_ID:-}"
ORDER_ID="${ORDER_ID:-}"
REFUND_BOOKING_ID="${REFUND_BOOKING_ID:-}"
REFUND_ORDER_ID="${REFUND_ORDER_ID:-}"
PAYOUT_AMOUNT_MINOR="${PAYOUT_AMOUNT_MINOR:-1000}"

require() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    echo "$name must be set." >&2
    exit 2
  fi
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "$1 is required." >&2
    exit 2
  }
}

require ADMIN_TOKEN "$ADMIN_TOKEN"
require XPEN_TOKEN "$XPEN_TOKEN"
require HUSTLE_SANDBOX_WEBHOOK_SECRET "$SECRET"
require BOOKING_ID "$BOOKING_ID"
require ORDER_ID "$ORDER_ID"

for tool in curl jq openssl; do require_command "$tool"; done

if ! [[ "$PAYOUT_AMOUNT_MINOR" =~ ^[1-9][0-9]*$ ]]; then
  echo "PAYOUT_AMOUNT_MINOR must be a positive integer." >&2
  exit 2
fi

json_get() {
  local token="$1"
  local path="$2"
  curl -fsS -H "Authorization: Bearer $token" "$API_BASE$path"
}

json_post() {
  local token="$1"
  local path="$2"
  local body="${3:-{}}"
  curl -fsS -X POST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    "$API_BASE$path" \
    -d "$body"
}

initialize_payment() {
  local token="$1"
  local subject_type="$2"
  local subject_id="$3"
  local idem="phase13-${subject_type,,}-${subject_id}-$(openssl rand -hex 8)"
  curl -fsS -X POST \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $idem" \
    "$API_BASE/payments/initialize" \
    -d "{\"subjectType\":\"$subject_type\",\"subjectId\":\"$subject_id\"}"
}

send_signed_event() {
  local type="$1"
  local reference="$2"
  local amount="$3"
  local currency="$4"
  local event_id="$5"
  HUSTLE_SANDBOX_WEBHOOK_SECRET="$SECRET" API_BASE="$API_BASE" \
    bash scripts/phase13-sandbox-event.sh "$type" "$reference" "$amount" "$currency" "$event_id"
}

heading() {
  printf '\n\n========== %s ==========\n' "$1"
}

assert_sandbox_attempt() {
  local json="$1"
  local provider
  provider="$(jq -r '.provider' <<<"$json")"
  if [[ "$provider" != "HUSTLE_SANDBOX" ]]; then
    echo "Refusing to drive signed sandbox test against provider '$provider'." >&2
    exit 3
  fi
}

payment_success() {
  local subject_type="$1"
  local subject_id="$2"
  local json
  json="$(initialize_payment "$ADMIN_TOKEN" "$subject_type" "$subject_id")"
  jq <<<"$json"
  assert_sandbox_attempt "$json"

  local payment_id reference amount currency event_id
  payment_id="$(jq -r '.id' <<<"$json")"
  reference="$(jq -r '.providerReference' <<<"$json")"
  amount="$(jq -r '.amountMinor' <<<"$json")"
  currency="$(jq -r '.currency' <<<"$json")"
  event_id="evt-${subject_type,,}-success-$(openssl rand -hex 8)"

  echo "Signed payment success:"
  send_signed_event payment.succeeded "$reference" "$amount" "$currency" "$event_id"

  echo "Duplicate delivery of the exact same provider event:"
  send_signed_event payment.succeeded "$reference" "$amount" "$currency" "$event_id"

  echo "Durable PaymentAttempt:"
  json_get "$ADMIN_TOKEN" "/payments/$payment_id" | jq
}

heading "PRE-FLIGHT"
echo "API base: $API_BASE"
echo "Tokens and webhook secret are loaded but will not be printed."

heading "BOOKING PAYMENT → FUNDED"
payment_success BOOKING "$BOOKING_ID"
echo "Booking after provider-confirmed payment:"
json_get "$ADMIN_TOKEN" "/bookings/$BOOKING_ID" | jq

heading "BOOKING WORK → COMPLETED"
echo "Hustler starts work:"
json_post "$XPEN_TOKEN" "/bookings/$BOOKING_ID/start" | jq
echo "Hustler completes work:"
json_post "$XPEN_TOKEN" "/bookings/$BOOKING_ID/complete" | jq

echo "Client releases completed escrow:"
json_post "$ADMIN_TOKEN" "/wallet/escrows/bookings/$BOOKING_ID/release" | jq

echo "Hustler wallet after escrow release:"
json_get "$XPEN_TOKEN" "/wallet" | jq

heading "ORDER PAYMENT → PAID"
payment_success ORDER "$ORDER_ID"
echo "Order after provider-confirmed payment and inventory ownership:"
json_get "$ADMIN_TOKEN" "/orders/$ORDER_ID" | jq

heading "ORDER FULFILLMENT → COMPLETED"
echo "Seller starts processing:"
json_post "$XPEN_TOKEN" "/orders/$ORDER_ID/process" | jq

ORDER_JSON="$(json_get "$XPEN_TOKEN" "/orders/$ORDER_ID")"
HAS_PHYSICAL="$(jq -r '[.items[].productTypeSnapshot == "PHYSICAL"] | any' <<<"$ORDER_JSON")"
if [[ "$HAS_PHYSICAL" == "true" ]]; then
  echo "Seller marks physical Order shipped:"
  json_post "$XPEN_TOKEN" "/orders/$ORDER_ID/ship" | jq
fi

echo "Seller marks Order delivered:"
json_post "$XPEN_TOKEN" "/orders/$ORDER_ID/deliver" | jq

echo "Buyer confirms completion:"
json_post "$ADMIN_TOKEN" "/orders/$ORDER_ID/complete" | jq

echo "Seller releases completed Order settlement:"
json_post "$XPEN_TOKEN" "/wallet/settlements/orders/$ORDER_ID/release" | jq

echo "Seller wallet after Product settlement:"
json_get "$XPEN_TOKEN" "/wallet" | jq

heading "WITHDRAWAL RESERVATION → SIGNED PAYOUT SUCCESS"
PAYOUT_IDEM="phase13-payout-$(openssl rand -hex 8)"
PAYOUT_JSON="$(
  curl -fsS -X POST \
    -H "Authorization: Bearer $XPEN_TOKEN" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $PAYOUT_IDEM" \
    "$API_BASE/wallet/withdrawals" \
    -d "{\"amountMinor\":$PAYOUT_AMOUNT_MINOR,\"currency\":\"NGN\"}"
)"
jq <<<"$PAYOUT_JSON"

PAYOUT_REFERENCE="$(jq -r '.providerReference' <<<"$PAYOUT_JSON")"
PAYOUT_AMOUNT="$(jq -r '.amountMinor' <<<"$PAYOUT_JSON")"
PAYOUT_CURRENCY="$(jq -r '.currency' <<<"$PAYOUT_JSON")"
PAYOUT_EVENT="evt-payout-success-$(openssl rand -hex 8)"

send_signed_event payout.succeeded "$PAYOUT_REFERENCE" "$PAYOUT_AMOUNT" "$PAYOUT_CURRENCY" "$PAYOUT_EVENT"
echo "Duplicate payout event:"
send_signed_event payout.succeeded "$PAYOUT_REFERENCE" "$PAYOUT_AMOUNT" "$PAYOUT_CURRENCY" "$PAYOUT_EVENT"

echo "Wallet after payout:"
json_get "$XPEN_TOKEN" "/wallet" | jq

echo "Withdrawal history:"
json_get "$XPEN_TOKEN" "/wallet/withdrawals?limit=20" | jq

if [[ -n "$REFUND_BOOKING_ID" ]]; then
  heading "OPTIONAL BOOKING REFUND"
  payment_success BOOKING "$REFUND_BOOKING_ID"
  REFUND_IDEM="phase13-refund-booking-$(openssl rand -hex 8)"
  REFUND_JSON="$(
    curl -fsS -X POST \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -H "Idempotency-Key: $REFUND_IDEM" \
      "$API_BASE/wallet/refunds" \
      -d "{\"subjectType\":\"BOOKING\",\"subjectId\":\"$REFUND_BOOKING_ID\"}"
  )"
  jq <<<"$REFUND_JSON"
  REF="$(jq -r '.providerReference' <<<"$REFUND_JSON")"
  AMT="$(jq -r '.amountMinor' <<<"$REFUND_JSON")"
  CUR="$(jq -r '.currency' <<<"$REFUND_JSON")"
  EVT="evt-refund-booking-success-$(openssl rand -hex 8)"
  send_signed_event refund.succeeded "$REF" "$AMT" "$CUR" "$EVT"
  echo "Refunded Booking:"
  json_get "$ADMIN_TOKEN" "/bookings/$REFUND_BOOKING_ID" | jq
fi

if [[ -n "$REFUND_ORDER_ID" ]]; then
  heading "OPTIONAL ORDER REFUND"
  payment_success ORDER "$REFUND_ORDER_ID"
  REFUND_IDEM="phase13-refund-order-$(openssl rand -hex 8)"
  REFUND_JSON="$(
    curl -fsS -X POST \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -H "Idempotency-Key: $REFUND_IDEM" \
      "$API_BASE/wallet/refunds" \
      -d "{\"subjectType\":\"ORDER\",\"subjectId\":\"$REFUND_ORDER_ID\"}"
  )"
  jq <<<"$REFUND_JSON"
  REF="$(jq -r '.providerReference' <<<"$REFUND_JSON")"
  AMT="$(jq -r '.amountMinor' <<<"$REFUND_JSON")"
  CUR="$(jq -r '.currency' <<<"$REFUND_JSON")"
  EVT="evt-refund-order-success-$(openssl rand -hex 8)"
  send_signed_event refund.succeeded "$REF" "$AMT" "$CUR" "$EVT"
  echo "Refunded Order:"
  json_get "$ADMIN_TOKEN" "/orders/$REFUND_ORDER_ID" | jq
fi

heading "RECONCILIATION"
echo "Client reconciliation:"
json_get "$ADMIN_TOKEN" "/wallet/reconciliation" | jq
echo "Hustler reconciliation:"
json_get "$XPEN_TOKEN" "/wallet/reconciliation" | jq

heading "FINAL WALLET HISTORY"
json_get "$XPEN_TOKEN" "/wallet/transactions?limit=100" | jq

echo
echo "Phase 13 consolidated happy-path gate finished. Review every JSON state above before closing the phase."
