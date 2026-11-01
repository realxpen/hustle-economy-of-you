# UX052 — TEST-only invited identity and read-only browsing acceptance

## Deployment basis (confirmed 1 November 2026)

- Dedicated payment-preview API [successful GitHub run 41310674080](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41310674080).
- Dedicated payment-preview Web [successful run 41317456496](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41317456496): hosted `/auth` 200, Web → API health 200, anonymous payment read denied 401.
- Read-only Neon census on the exact `fragrant-field-59689896` / `br-curly-leaf-zat0ec8m` / `hustle_payment_preview` target: **0** `payment_auth.user`, **0** `payment_auth.session`, **0** `public.User`, **0** services/products/bookings at the time of inspection. No invited-user login or substantive browsing evidence exists yet.

## What this PR delivers

1. PR-safe `public` runner validates the **deployed, independent** Web origin: sign-in HTML, Web-to-API health, anonymous identity denial, signed-out Better Auth session and guest discovery endpoints. GET-only, zero secrets. No financial calls.
2. A separately **manual/main-only, environment-protected** `invited` runner signs in with an **existing invited TEST-only account**, verifies restored Better Auth session twice, checks owner-account GET, and verifies an intentionally invalid credential cannot access payment data. Its own TEST session is signed out at the end. No customer data, payment, order, checkout, ledger or webhook mutation. Email, password, session tokens, cookies, response bodies and user identifiers are never printed.
3. All target URLs are fixed literals for `hustle-payment-preview.realxpens.workers.dev` and its independently deployed TEST API. No arbitrary URL input, no use of production/staging resources, no deployment actions.

## One-time prerequisite for actual invited-user PASS

Because the isolated database currently contains **no users**, an approved test invitee must create a **unique test-only login** at [the deployed private TEST sign-in page](https://hustle-payment-preview.realxpens.workers.dev/auth). Use the **invited TEST email** already configured in the separate AWS secret, choose **Create invited test account**, and set a new unique 12–128-character password. Do not use a production password or paste credentials into ChatGPT or source control. The app's ordinary signup follows the existing Better Auth email invitation and Hustle Client account-sync rules.

To opt into the protected automated verification later, add only these two **GitHub environment secrets** under `hustle-payment-preview` (not repository secrets):
- `HUSTLE_PREVIEW_TEST_AUTH_EMAIL`: exact already-registered invited TEST email.
- `HUSTLE_PREVIEW_TEST_AUTH_PASSWORD`: this account's unique TEST-only password.

Then manually dispatch `Hustle TEST Payment Preview Identity Acceptance` on `main` with `I_AUTHORIZE_TEST_ONLY_INVITED_AUTH_ACCEPTANCE`; the environment must retain required reviewers and main-only restrictions. This never automatically runs on PRs. If an account has not yet been created or the environment secrets are absent, the protected job must fail closed, not claim acceptance.

## What remains outside scope

No proof of actual authenticated login until the protected job passes. No signed-in Client/Hustler journeys, onboarding, media, booking submission, checkout, Paystack transactions, escrow, refunds, withdraws or production go-live. Any future TEST financial transaction acceptance needs a separate explicit approval and disposable fixtures.
