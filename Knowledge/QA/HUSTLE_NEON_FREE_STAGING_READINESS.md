# Hustle — isolated Neon Free staging (infrastructure smoke)

**Created on:** 2026-10-22  
**Scope:** A free and isolated test-only Neon project and one public **hosting-only** readiness function. **NOT a deployed Hustle NestJS API or connected Expo app.**

## Approved decision and current resources

The owner explicitly approved a **free, separate test environment** with no existing project/account/payment data reused.

| Resource | Scope |
|---|---|
| Neon org | Free plan; existing organization already used for other unrelated projects, which were not changed |
| Project ID | `summer-sound-54525078` — **hustle-isolated-staging** |
| Branch | `br-dawn-hat-zag7c5ae` / `staging`; no copy/branch of existing production data |
| PostgreSQL | Dedicated `hustle_staging`, PG 17, London, 0.25 CU min/max |
| Authentication | Neon Managed Better Auth provisioned on this branch, `neon_auth` isolated schema |
| Public identity issuer | Managed Auth base URL in private Neon console; **do not commit user secrets or service credentials** |
| Staging function | `staginghealth` serving `GET /health` or `GET /`; no private API, JWT, data or payment support |

**No Supabase resources were changed.** The existing free-tier Supabase allocation remains occupied by other projects. Supabase branching and additional projects must not be used as a supposed free staging shortcut.

Neon Managed Auth currently allows self-registration by default. **Do not invite testers or claim isolated sign-in acceptance until the auth flow, verification policy, session validation, and protected routes have been implemented and validated.** Do not create test accounts with passwords in issues, repository files, logs or chat.

## Staging function and security

`infra/neon/staging/health/index.mjs` deliberately returns `check: "hosting-only"`, `connectedApiReady: false`, `liveAuthenticationTested: false`, `bookingWritesEnabled: false` and `financialProvidersEnabled: false`. It contains **no** credentials, database connectivity, authentication bypass, sensitive values or POST actions.

`scripts/staging/neon-health-contract.mjs` executes the same source locally (no network, no credentials), validates GET routing, denied mutation methods and truthful readiness status. GitHub Actions invokes it separately from existing API/Android gates.

## Mandatory next gates before "Connected staging READY"

- [x] Dedicated new Free Neon project provisioned and confirmed separate from production
- [x] Managed Better Auth provisioned on that project
- [ ] Neon staging health function deployed to HTTPS and actual GET smoke-verified (the local source contract alone is not a public-host proof)
- [ ] Database schema applied using **actual** reviewed Prisma migrations with baseline preservation, protected credentials and no production DB writes; **not** manually copied from live app data
- [ ] Staging-only NestJS deployment connected to that specific branch/database with fail-closed environment identity
- [ ] Verify managed JWT JWKS, issuer, expiry, audience if applicable, provider namespace and denial of Supabase/prod/malformed tokens
- [ ] Test-only Expo login token transport and session lifecycle, with no auth fallback to production
- [ ] Two consented disposable Client/ACTIVE Hustler identities, published staged-only service/post and read-only availability
- [ ] Real signed-in Android browser/device acceptance; no EAS credits used without owner approval
- [ ] No booking, payment, payout, marketplace submission or escrow activation

**Operational caveat:** A health endpoint proves that hosting responds; it does **not** establish application readiness or authorization. A temporary GitHub localhost test also does not constitute a permanent public API. Keep [connected acceptance issue #179](https://github.com/realxpen/hustle-economy-of-you/issues/179) and [Vercel deployment limit #176](https://github.com/realxpen/hustle-economy-of-you/issues/176) distinct.

**Cost/safety:** Account is Free. The staging function stays within Neon Free usage limits where available; exceeding included quotas or adding paid capacity needs new explicit approval. No private user data, live payments or existing Supabase databases touched.
