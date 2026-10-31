# UX043 — Dedicated payment-preview Web Worker and protected release gate

**State: build workflow implemented, deployment NOT authorized or performed.**

UX041 proved genuine Paystack TEST provider webhook delivery to real disposable Product Order, Booking and escrow ledger logic ([run 41154579757](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41154579757)). UX042 ([PR #289](https://github.com/realxpen/hustle-economy-of-you/pull/289)) added a completely independent `payment-preview` API scope, exact preview API/web origins and fail-closed finance routes. It **did not** provision or deploy the new infrastructure.

## UX043 code delivery

1. A third, **separately named** Cloudflare Web Worker build target `hustle-payment-preview` is selected only via `HUSTLE_PAYMENT_PREVIEW_BUILD=true`. Existing `hustle-ios-pwa-staging` and `hustle-ios-pwa-aws-test` names, default routing and AWS cutover builds remain unchanged. All three build modes are mutually exclusive.
2. Dedicated Worker binds `HUSTLE_ISOLATED_PWA_GATE=payment-preview`, `HUSTLE_API_BACKEND_TARGET=payment-preview`, private-test Better Auth proxy mode, and **only** `https://hustle-payment-preview-api.realxpens.workers.dev`. No arbitrary upstream origin and no embedded database, Paystack or Supabase secrets.
3. The **manually dispatched** GitHub Actions workflow `hustle-payment-preview-web-deploy.yml` is limited to the exact repository, `main`, an explicit `I_AUTHORIZE_SEPARATE_PAYMENT_WEB_PREVIEW_ONLY` choice, and the new protected environment name `hustle-payment-preview`. Do not remove environment reviewers or protection for convenience.
4. Before obtaining Cloudflare deploy secrets, its job checks exact release flags, local unit tests, TypeScript, **the exact separate API URL health 200**, and **anonymous financial GET denial 401**. An API outage, reused staging origin or unsafe auth response prevents Web publication. It then compiles and deploys *only* the separate Worker.
5. Offline CI executes the real Cloudflare config against default, AWS preview, AWS cutover and payment-preview environments, rejects mixed flags, builds the new Worker using vinext and locally probes its private-test sign-in page. No provider calls or deployments occur in PR CI.

## Required prerequisites for the manual deployment

Do **not** click the manual workflow until all these conditions hold:

- A **separately authorized** new Neon project/branch and dedicated `hustle_payment_preview` database exist, with no production/staging-data copy, `hustle_payment_preview_api` role, and `public` + `payment_auth` schemas. The currently connected Neon account did **not** have a separate payment-preview project at the time UX043 was authored (October 31, 2026).
- A **separately deployed** Nest payment-preview backend is bound through the reviewed, dedicated `hustle-payment-preview-api.realxpens.workers.dev` origin, not the existing Vercel or AWS staging services; its finance and auth routes enforce the UX042 payment-preview runtime checks.
- The backend's Paystack secret is strictly `sk_test_` and stored only in its separate protected environment. The **Cloudflare Web build must never hold this provider secret**. The Paystack TEST dashboard webhook must be set to the new dedicated API only after its production-equivalent security acceptance; never edit Live webhook URL.
- GitHub repository's new environment `hustle-payment-preview` is configured with **required reviewers**, main-only branch protection and the narrow Cloudflare deploy credentials. Its existence or required-reviewer configuration is **not** implied by defining its name in workflow YAML.
- Founder explicitly reviews and approves the infrastructure/costs, PR merge, **and separately** the actual protected deploy workflow. No deployment or new Neon project is created by merging.

## Manual procedure after all prerequisites are met

GitHub Actions → *Hustle Dedicated Paystack TEST Web Preview (manual only)* → **main** → `I_AUTHORIZE_SEPARATE_PAYMENT_WEB_PREVIEW_ONLY`. The workflow preflights the independent API before publishing. Only the new Worker `hustle-payment-preview.realxpens.workers.dev` can be updated. Finally test invited account login, Cart → Order → Test Checkout → Verified Return, paid Booking → HELD escrow → completion/release, and real Paystack TEST signed webhook idempotency.

Do not use real cards or customer data in this environment. This workflow does not create Paystack settlement, payouts, a regulated escrow arrangement, a database, an API backend, or a durable webhook endpoint on its own.

## Rollback

Disable or delete **only** the `hustle-payment-preview` Worker using Cloudflare's separate Worker settings after explicit approval; do not redeploy the normal staging Worker. Preserve the independent Neon project and Paystack TEST dashboard configuration until audited and explicitly retired. No production changes.

