# UX037 — Paystack test return verification without trusting redirects

## Status
Implementation proposal. No live Paystack request, production activation, or payment deployment.

## User experience
A buyer can press **Check payment confirmation** on a pending Paystack test Order or Booking. When returning from the configured Paystack callback URL with `payment_return=1`, Hustle automatically runs the same check once. This is merely a trigger for authenticated server-side verification; callback URL parameters, query references, and client-provided amount are **not** accepted as evidence.

## Server trust boundary
- Buyer auth/ownership of the *existing* PaymentAttempt is mandatory.
- Server looks up its *own persisted* Paystack test reference.
- Backend calls Paystack `GET /transaction/verify/:reference` with a private `sk_test_` key.
- Only `status=success`, `domain=test`, matching reference, exact persisted minor amount, and matching currency allow existing PaymentAttempt/Order/Booking/ledger transitions. Other states stay pending; failures remain visible for retry/check, never silently credited.
- Uses a new, deterministic reconciliation event ID and digest, separate from the signed raw webhook event. Existing ledger and Order idempotency protect delayed webhooks and repeated checks.
- Invalid provider/amount/currency evidence is rejected **before** persisting the event inbox, so bad evidence cannot poison a pending attempt.

## Verification
The existing isolated payment sandbox tests real Nest services and disposable PostgreSQL Orders with a completely stubbed Paystack provider response, for:
- Signed webhook first, invalid signature, tampered amount, replay and inventory/ledger idempotency.
- **Direct provider-check first**, provider-pending, different user denial, mismatched amount, successful Order transition, repeated confirmation and subsequent delayed webhook without double posting.

All workflows remain non-deploying; the existing isolated staging setup continues refusing external financial credentials. A genuine hosted end-to-end Paystack test checkout still requires an independently approved, isolated deployment and privately supplied test credentials; it is NOT achieved by this PR.

Reference: https://paystack.com/docs/payments/verify-payments/
