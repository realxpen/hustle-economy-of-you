# UX051 — TEST payment-preview Web-to-API 502 diagnosis and guarded repair

## Actual evidence (1 November 2026)

- [Protected Web release #41315213668](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41315213668) passed locked dependencies, Cloudflare configuration, TypeScript, the separate API preflight and production-mode Vinext build. Wrangler published **only** the dedicated `hustle-payment-preview` Worker at `https://hustle-payment-preview.realxpens.workers.dev`. The final read-only smoke step failed with an opaque exit 1.
- [UX051 read-only diagnostic #41315856991](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41315856991) confirmed:
  - Web `GET /auth` = **200**, with `PRIVATE TEST` text present;
  - Web `GET /api/isolated/api/v1/health` = **502**;
  - Web anonymous payments `GET` = **502**;
  - Direct dedicated API `GET /api/v1/health` = **200**;
  - Direct API anonymous payments `GET` = **401**.
- These results localize the defect to the deployed Web Worker → separate API Worker hop. The original release's HTML auth smoke did not fail. Actual invited-user login was **not** tested.
- Cloudflare documents same-zone Worker-to-Worker `fetch` to `workers.dev` origins and error 1042 behavior. The exact internal exception was not exposed by the source logs; the compatibility flag is a scoped evidence-based fix, not yet a proven hosted resolution.

## Changes

1. **Only** the opt-in Web Worker build (`HUSTLE_PAYMENT_PREVIEW_BUILD=true`) adds `global_fetch_strictly_public` alongside its existing `nodejs_compat` flag. Both existing regular staging and AWS preview Workers keep exactly their original compatibility flags, build names and bindings. Public fetch uses the already literal-pinned `https://hustle-payment-preview-api.realxpens.workers.dev` origin, not an arbitrary request parameter. Cloudflare service bindings are an alternative for future hardening.
2. The protected manual release now logs only HTTP status codes at each verification step; it separately asserts Web auth 200, `PRIVATE TEST`, Web-to-API health 200, and anonymous Web payment denial 401, and reports a clear failure reason. These GETs use no test-user credentials, cookies, financial mutation, Paystack callback, or webhook action.
3. The independent PR diagnostic job prints only status/marker booleans, with no response bodies or secrets. Local Cloudflare config regression checks verify flag isolation.

## Release boundary

This PR does **not** deploy or change any Worker; staging, existing AWS preview, live Paystack, payment flows, IAM and production remain unchanged. Only after PR CI passes and the owner merges should the protected, main-only `hustle-payment-preview-web-deploy.yml` be rerun with `I_AUTHORIZE_SEPARATE_PAYMENT_WEB_PREVIEW_ONLY` to test the actual hosted fix. Passing automated hosted smoke is **not** proof of invited-user authentication or real TEST checkout/ledger/escrow acceptance. Those require separate consent and test-only fixtures.
