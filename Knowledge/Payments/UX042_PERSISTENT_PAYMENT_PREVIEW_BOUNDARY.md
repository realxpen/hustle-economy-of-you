# UX042 — Separate persistent Paystack TEST preview runtime (code boundary)

**State:** Implemented behind a fail-closed configuration gate. **No persistent payment-preview API, database, DNS, Worker or Paystack webhook has been deployed or configured by this PR.** UX041's genuine provider-delivered test callback is confirmed by [GitHub run #41154579757](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41154579757).

## Reason for a new runtime

Hustle's working iPhone staging API deliberately denies `PAYSTACK_TEST_SECRET_KEY`, `/payments/initialize`, `/cart/checkout`, real paid escrow and ordinary payment mutations. That is a valuable boundary and **must remain unchanged**. UX042 adds `HUSTLE_RUNTIME_SCOPE=payment-preview`, separate from `isolated-staging`, with backend and web proxy code restricted to a future **independently isolated** test environment.

## What is implemented

- `apps/api/src/payment/payment-preview-runtime.ts`: startup rejects nonproduction/lax credential setups, unreviewed domain names, any old staging child/project identifiers, shared staging or production provider credentials, missing private `sk_test_` provider key, non-TLS DB, wrong DB names/roles/schemas and all unauthorised activation values.
- Exactly one independently provisioned Neon payment test DB `hustle_payment_preview`, role `hustle_payment_preview_api`, and schema `public`; a **separate** auth schema `payment_auth` for invited Better Auth test accounts. No parent/old staging branch reuse. GitHub's protected configuration must pin the reviewed host, branch and distinct project IDs before a deployment can pass validation.
- Preview API origin reserved by contract: `https://hustle-payment-preview-api.realxpens.workers.dev`. Preview web origin reserved: `https://hustle-payment-preview.realxpens.workers.dev`. These are **not verified to exist** and are not active services. An eventual API Worker may proxy a separately authorized backend; its existence is not implied by this code.
- `apps/api/src/payment/payment-preview-request-policy.ts` gates a narrow paid product/cart/Order, accepted paid Booking, buyer-verified Paystack attempt, Paystack-signed webhook, Buyer escrow release and Seller fulfillment lifecycle. All existing Nest AuthGuard/ownership and Paystack's real API verification still apply. Wallet withdrawals, provider refunds, admin actions, sandbox fake-funding endpoints and arbitrary requests remain blocked.
- Existing app sign-in can use a separate invited Better Auth database for this scope via the same established AuthPort, with a distinct API domain. **No staging login/session database is shared**.
- Existing web finance UI stays unchanged. A new **opt-in** preview proxy target routes only to the exact reserved preview API Worker origin and permits payment requests with idempotency keys. The ordinary staging Worker still cannot forward checkout/payment writes.
- Pull-request CI checks backend startup and request boundary with extensive negative cases, existing full Nest/disposable-PG payment tests, web typecheck and Foundation CI. None require a Paystack key or access a remote DB in PR CI.

## Safety & what is still required before app-connected browser acceptance

These are **future deployment preconditions**, not performed by merging:

1. Independently provision and review a **new nonproduction Neon project/branch** with a database `hustle_payment_preview`, dedicated `hustle_payment_preview_api` role, `public` domain schema and `payment_auth` isolated Better Auth schema, using existing reviewed Prisma migrations against only that test target. Do **not** copy production data or staging cookies.
2. Establish a separately named nonproduction compute deployment for the Nest API and a restricted Cloudflare API Worker bound to the **exact reserved API origin**. The Worker must not proxy `/admin`, production auth or other unrelated services. Protect it with a separate GitHub environment and deploy approval; configure only a protected `sk_test_` key. No Live provider keys.
3. Publish a **different** Cloudflare iPhone PWA Worker at the exact reserved web origin, with build flags `HUSTLE_ISOLATED_PWA_GATE=payment-preview`, `HUSTLE_API_BACKEND_TARGET=payment-preview`, `NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=true`, `HUSTLE_PAYMENT_PREVIEW_API_ORIGIN=https://hustle-payment-preview-api.realxpens.workers.dev`. Existing staging and AWS preview Workers must not be redeployed/rebound.
4. Keep the Paystack **TEST** webhook URL on the new stable dedicated HTTPS payment-preview API path `/api/v1/payments/webhooks/paystack`. Allow only Paystack signed `charge.success` and independently verified test transaction evidence; protect against duplicate ledger capture and cross-account release. Do not change Live webhook settings or infer paid status from browser redirects.
5. Validate invited test auth, Order, Booking, Product stock, one-time escrow release, webhook retries, browser redirect and buyer verification *end-to-end* before declaring the persistent environment usable. Review cost, secure hosting, rate limiting, domain ownership, DNS, logs, cleanup/rollback and whether the user wants test data retained.

### Proposed dedicated environment variables (not secrets to paste into PR)

`HUSTLE_RUNTIME_SCOPE=payment-preview`, `HUSTLE_PAYMENT_PREVIEW_APPROVAL=I_AUTHORIZE_SEPARATE_TEST_PREVIEW_ONLY`, `NODE_ENV=production`, `HUSTLE_AUTH_PROVIDER=expo-better-auth`, `HUSTLE_PAYMENT_GATEWAY=paystack-test`, `HUSTLE_FINANCIAL_PROVIDERS_ENABLED=test-only`, plus private `PAYSTACK_TEST_SECRET_KEY`, distinct database URLs, Better Auth secret, reviewed Neon pin identifiers and test-email invitations. All of those are validated at boot; never set them on existing staging.

## Important limits

A PR compile/CI pass proves **configured-code boundaries**, not availability of an external persistent environment. UX041 already proved real Paystack TEST webhook delivery using a disposable tunnel. UX042 prepares reusable app-connected runtime separation without deploying, provisioning database, exposing a permanent endpoint, charging customers, releasing external funds, or representing a regulated escrow provider. The dedicated compute/provisioning deployment is a separate **manual approval milestone**.
