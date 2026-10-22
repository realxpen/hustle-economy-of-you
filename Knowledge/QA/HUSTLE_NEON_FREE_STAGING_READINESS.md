# Hustle — isolated Neon Free staging (infrastructure smoke)

**Created on:** 2026-10-22  
**Scope:** A separate free Neon DB/Auth staging project, an empty Vercel test-only API project, and a prepared (NOT deployed) health function. **There is NO publicly deployed staging API or connected Expo test.**

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
| Neon Functions | **BLOCKED:** its API returned HTTP 404: `platform functions not available for this project`. `staginghealth` was NOT deployed |
| Vercel test API project | `hustle-isolated-staging-api` (ID `prj_1zba0YSCmWxYxkKQApt8JGAgVTHW`), `apps/api`, NestJS, **not connected to Git**, **not deployed**, no environment credentials |
| Independent Vercel projects | Existing API/Web/Admin projects unchanged; quota issue #176 still pending |

**No Supabase resources were changed.** The existing free-tier Supabase allocation remains occupied by other projects. Supabase branching and additional projects must not be used as a supposed free staging shortcut.

Read-only SQL confirmed `neon_auth.user` exists in the new `hustle_staging` database; `public.\"User\"` does **not** yet exist. This is direct evidence that the separate auth schema was provisioned but the Hustle application has NOT been migrated. No passwords or user records were retrieved.\n\nNeon Managed Auth currently allows self-registration by default. **Do not invite testers or claim isolated sign-in acceptance until the auth flow, verification policy, session validation, and protected routes have been implemented and validated.** Do not create test accounts with passwords in issues, repository files, logs or chat.

## Staging function and security

`infra/neon/staging/health/index.mjs` is a **prepared, provider-independent Fetch-style handler**, not an active deployment. An attempted deploy to the new Neon branch returned an explicit provider HTTP 404 (Functions unavailable); no function was created. It deliberately returns `check: "hosting-only"`, `connectedApiReady: false`, `liveAuthenticationTested: false`, `bookingWritesEnabled: false` and `financialProvidersEnabled: false`. It contains **no** credentials, database connectivity, authentication bypass, sensitive values or POST actions.

`scripts/staging/neon-health-contract.mjs` executes the same source locally (no network, no credentials), validates GET routing, denied mutation methods and truthful readiness status. GitHub Actions invokes it separately from existing API/Android gates.

## Mandatory next gates before "Connected staging READY"

- [x] Dedicated new Free Neon project provisioned and confirmed separate from production
- [x] Managed Better Auth provisioned on that project
- [ ] HTTPS health function actually deployed and GET smoke-verified — **BLOCKED on Neon Functions availability**; consider the separate Vercel test API project when quota and runtime isolation are ready. The source test alone does not prove public hosting
- [ ] Database schema applied using **actual** reviewed Prisma migrations with baseline preservation, protected credentials and no production DB writes; **not** manually copied from live app data
- [ ] Staging-only NestJS deployment connected to that specific branch/database with fail-closed environment identity
- [ ] Verify managed JWT JWKS, issuer, expiry, audience if applicable, provider namespace and denial of Supabase/prod/malformed tokens
- [ ] Test-only Expo login token transport and session lifecycle, with no auth fallback to production
- [ ] Two consented disposable Client/ACTIVE Hustler identities, published staged-only service/post and read-only availability
- [ ] Real signed-in Android browser/device acceptance; no EAS credits used without owner approval
- [ ] No booking, payment, payout, marketplace submission or escrow activation

**Operational caveat:** A health endpoint proves that hosting responds; it does **not** establish application readiness or authorization. A temporary GitHub localhost test also does not constitute a permanent public API. Keep [connected acceptance issue #179](https://github.com/realxpen/hustle-economy-of-you/issues/179) and [Vercel deployment limit #176](https://github.com/realxpen/hustle-economy-of-you/issues/176) distinct.

**Cost/safety:** Account is Free. The staging function stays within Neon Free usage limits where available; exceeding included quotas or adding paid capacity needs new explicit approval. No private user data, live payments or existing Supabase databases touched.

## Actual provisioning and outstanding blockers, verified October 22

**Neon:** project `summer-sound-54525078`, auth branch `br-dawn-hat-zag7c5ae`, service `better_auth`, 0.25 CU compute, dedicated PG17 London database. Read-only SQL returned `auth_user_table_exists=true`, `hustle_application_users_exist=false`.

**Neon Functions:** First deployment of the `staginghealth` source was refused by the provider with HTTP 404 `platform functions not available for this project`; querying functions reports the same. **No URL is available and no function was deployed**. The portable, no-data handler is retained in this source PR for future use once an authorized host exists.

**Vercel:** created the specifically isolated `hustle-isolated-staging-api` project with NestJS framework and Git auto-connect disabled. No deployment, secret, live route or API calls have been initiated. Hobby plan is intended for noncommercial personal testing, not a money-handling commercial launch. Existing staging web/API/admin projects and their credentials were **not** changed.

**Critical next implementation:** introduce separately configured, fail-closed Neon Managed Auth JWT verification for staging (issuer/JWKS from **this branch only**, no generic accept-all Bearer), and a matching **staging-only** Expo login adapter. Review/test Prisma migrations against this empty DB before connecting and deploying the API; do not import real accounts or balances. The staging Vercel deployment must not be initiated until build-rate limits, correct app handler, service protection and nonproduction credentials have been verified.
