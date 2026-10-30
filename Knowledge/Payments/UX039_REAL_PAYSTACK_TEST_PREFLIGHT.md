# UX039 — Protected real Paystack test-mode API preflight

## Decision and existing boundaries
UX035–UX038 are merged: actual Nest/Prisma payment pipeline, signed webhooks, buyer-triggered provider verification, complete disposable Postgres Product + paid Booking acceptance. All those PR tests mocked Paystack HTTPS responses. This next milestone tests the **actual Paystack TEST API** without exposing the existing iPhone/Neon staging environment to external credentials or checkout writes.

The active `isolated-staging` runtime **must continue rejecting `PAYSTACK_TEST_SECRET_KEY`** and the staging request gate must continue denying checkout/payment writes. Do not change the existing AWS staging, Cloudflare, Vercel, child Neon or Supabase production data, auth, or payment settings for this preflight.

## PR changes
1. `POST /api/v1/payments/webhooks/paystack` now explicitly returns **HTTP 200** rather than Nest's default 201. The real Paystack webhook delivery contract expects HTTP 200 acknowledgement; the existing offline HTTP integration now asserts this.
2. `scripts/payment-sandbox/real-paystack-preflight-guard.mjs` is a pure, early **fail-closed** runtime gate for a main-only manual GitHub Actions run with an exact authorization phrase, `NODE_ENV=test`, `HUSTLE_PAYMENT_GATEWAY=paystack-test`, exact disposable localhost database credentials and a private `sk_test_` key. No callback origin, production/Neon/Supabase/provider secrets or actual production/staging database are allowed.
3. `scripts/payment-sandbox/check-real-paystack-preflight.mjs` tests all unsafe cases OFFLINE on pull requests, without any Paystack key or network request.
4. `scripts/payment-sandbox/real-paystack-test-preflight.mjs` uses real Nest modules + disposable PostgreSQL User, professional profile, Product, Cart, and PENDING Order. It calls the **real Paystack TEST HTTPS** `transaction/initialize` and `transaction/verify/:reference` endpoints through the merged Paystack gateway. It ensures checkout is HTTPS at the exact Paystack host, reference and canonical Order amount match, repeated initialization is idempotent, and the Order remains PENDING with zero captured ledger or escrow. It never opens the checkout, selects payment methods, or completes any payment. No private key or checkout URL is written to the Actions logs.
5. `.github/workflows/paystack-real-test-preflight.yml` runs **only** on a manual `workflow_dispatch`, with founder-approved choice and GitHub environment `hustle-paystack-test-preflight`. It uses the environment secret `HUSTLE_PAYSTACK_TEST_SECRET_KEY` only on `main`; no pushes or PRs can execute the provider network call. It creates/destroys only a local runner PostgreSQL service. It never deploys.

## What remains for the owner-controlled real API preflight
After this PR is reviewed/merged and any required GitHub environment controls are configured:
- Use the GitHub environment `hustle-paystack-test-preflight` with a **private environment secret** `HUSTLE_PAYSTACK_TEST_SECRET_KEY` containing a *test-mode* `sk_test_` value. Configure appropriate required reviewers/environment protection. **Never paste the secret into ChatGPT, issues, PRs or files.**
- Explicitly dispatch `Hustle Paystack Real Test-Mode Provider Preflight (manual, no deployment)` on `main` with `I_AUTHORIZE_TEST_PROVIDER_INITIALIZE_ONLY`. The action must be an approved, deliberate test-only provider request; merging the PR alone does not trigger it.
- If the key is missing, a wrong key type, wrong environment, or Paystack returns an error, the workflow fails. Do not bypass guards or fall back to production credentials.

## Interpretation
A green **manual real-provider run** will prove Paystack TEST API key/network initialization + pending verification with an actual Nest/DB Order, **not** an actual payment, paid Order, signed webhook delivered by Paystack, Paystack settlement, legal custody, production readiness or a hosted iPhone checkout. Those remain separate product/security/approval milestones requiring an isolated publicly reachable API and test-mode webhook. No test-mode provider call has been executed merely by adding this workflow.

Paystack sources: https://paystack.com/docs/api/transaction/ and https://paystack.com/docs/payments/webhooks/ and https://paystack.com/docs/api/authentication/
