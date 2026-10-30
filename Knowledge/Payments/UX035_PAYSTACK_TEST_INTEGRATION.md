# UX035 — Paystack test gateway in the real Hustle payments pipeline

## Objective
Develop and test one integrated Hustle application, rather than separate fake checkout screens. Reuse the real user, Product, Cart, Order, Booking, PaymentAttempt, webhook evidence and ledger APIs. Connect Paystack's actual **test** Transaction API as a selectable gateway. This is **not** live-money acceptance and not compliant third-party custody/escrow.

## Already implemented
- `PAYMENT_GATEWAY` remains the existing dependency-injection port. By default the API still uses `SandboxPaymentGateway`, so old tests and environments are untouched.
- `HUSTLE_PAYMENT_GATEWAY=paystack-test` selects the real provider adapter. `PAYSTACK_TEST_SECRET_KEY` must start with `sk_test_`; `sk_live_` is explicitly rejected. No key is passed to the client or committed to GitHub.
- Payment initiation uses the authenticated and verified buyer's email, the actual server-derived Order or Booking amount (in kobo), NGN and a reference tied to the Hustle PaymentAttempt. The provider returns an **actual checkout.paystack.com URL**.
- `POST /api/v1/payments/webhooks/paystack` accepts Paystack events only while this integration is selected. It verifies the HMAC SHA512 **raw bytes**, independently calls Paystack `GET /transaction/verify/:reference`, checks its test domain, success status, immutable transaction ID, reference, amount and currency, then passes the evidence to the existing idempotent payment/ledger transaction handler.
- Duplicate signed notifications and unknown references use existing evidence and idempotency rules; unrelated Paystack events are ignored. A provider callback or frontend redirect **never** marks an Order or Booking paid.
- Staging-only API branches remain blocked for external provider keys. This work does not modify AWS or Cloudflare infrastructure.
- Existing Order Detail/Booking finance action already initializes through `/payments/initialize` and redirects if `checkoutUrl` is present. No fake Cart or frontend-only checkout implementation.

## To connect your Paystack account for genuine end-to-end testing
1. Use an **isolated development database with test orders**, not a production/customer finance database. Test payments do not move money. This is a data-safety requirement, not a separate frontend mock.
2. Configure the development API server environment privately with `HUSTLE_PAYMENT_GATEWAY=paystack-test`, `PAYSTACK_TEST_SECRET_KEY=sk_test_...`, and optionally `PAYSTACK_TEST_RETURN_ORIGIN=https://your-development-hustle-web-host`. Do not put keys in `NEXT_PUBLIC_*` / `EXPO_PUBLIC_*` variables. Use a signed-in, verified-email account.
3. In your Paystack dashboard, switch to **test** mode and set its webhook URL to `https://your-api-host/api/v1/payments/webhooks/paystack`. Make the endpoint publicly reachable via HTTPS. Never point this webhook at a live-money backend.
4. Test as a buyer: Product → Cart → Checkout (creates unpaid Order) → Order Detail → Start secure payment → Paystack test checkout → return to Order Detail → check transaction state via refreshed authenticated APIs. For services, do consultation/Booking then begin funding from its authorized PAYMENT_PENDING state.
5. Verify successful payment, declined/cancelled checkout (must **not** mark paid), duplicate webhook, incorrect signature, changed amount/currency, wrong reference, and retry after provider outage. The webhook must be the authoritative payment evidence, and stock/booking status must update only after valid confirmation.

## Boundaries
- The code is an integration PR. It contains no dashboard connection, credentials, live provider request, environment mutation, or live deployment.
- This does **not** create Paystack split recipients, make payouts, implement legal escrow custody, enable production payments or turn on monetary transactions. Hustle's existing ledger may label simulated test funds as held for workflow testing; this is **not** evidence that money is held by a legally authorized escrow provider.
- Before any live rollout: financial reconciliation, refund/dispute behavior, custody model, merchant KYC and real-money disbursements require separate review and approval.
- Paystack's public documentation: https://paystack.com/docs/payments/accept-payments/ and https://paystack.com/docs/payments/webhooks/
