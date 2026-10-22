# Hustle — Free, isolated connected-API acceptance

**Prepared:** October 22, 2026  
**State:** Original isolated API HTTP acceptance PASS on [run #39706352409](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39706352409); Foundation CI [#39706352389](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39706352389) PASS; PR #180 merged. Follow-up Expo mobile-adapter runtime acceptance below requires its own exact-head green run.  
**Cost target:** Existing GitHub hosted runner and throwaway PostgreSQL service, with **no new hosted database or billing agreement**.

## Why this is the safe first staging step

The owner explicitly authorized a **free, test-only Hustle environment** while keeping existing real data and payment systems untouched. Inspection of the connected Supabase account found that `MONIFlow` and `hustle-economy of you` already occupy two active projects in the user's Supabase organization; `Personal OS` is inactive. Supabase's free tier allows two active projects across organizations owned/administered by a user. Do not pause, repurpose or modify those apps merely to create a Hustle staging copy, and do not silently incur a third project's cost. Other providers such as Neon could supply isolated Postgres but **not a new independent Supabase Auth instance** required by the current connected Expo app.

A separate, accessible, deployed HTTPS environment with real test sign-up remains a *different milestone*. This first stage creates an **ephemeral localhost-only** API test environment in a GitHub Actions runner, detached from all existing cloud account resources. It exercises the actual NestJS HTTP routes and Prisma migrations on PostgreSQL rather than merely parsing source or fabricating an API response.

## Implementation

Workflow: `.github/workflows/hustle-free-isolated-connected-api.yml`, triggered by relevant source PRs or an explicit manual dispatch.

Test runner: `scripts/experience/free-isolated-connected-api.cjs`.

- Launches a fresh PostgreSQL 16 container at **127.0.0.1:55439/hustle_payment_sandbox** inside the isolated Actions job and refuses every other database endpoint.
- Reuses the existing isolated Supabase-compatibility DDL and the actual existing Prisma migrations. Never applies migrations to a hosted database.
- Builds the **actual NestJS API**, imports its Search and Booking controllers, then binds it exclusively to **127.0.0.1** on an ephemeral port; the server never becomes public or accessible from a phone.
- Installs two process-local synthetic bearer identities for the test runner **by temporarily overriding the auth service prototype inside that Node process**. This substitution is never compiled into product modules, API configuration, production deployments, or mobile preview. It does **not** prove real Supabase authentication, email confirmation or connected mobile login.
- Creates disposable Client and ACTIVE Hustler rows, a published professional profile, actual published post/service/product records and both appointment/work-queue modes.
- Makes real HTTP GET calls to the protected Search Top/People/Posts/Services/Products endpoints, verifies unauthorized/invalid-token rejection, canonical owner links, a real cursor page, and publication visibility.
- Makes read-only HTTP GET calls to real `/bookings/slots` for an appointment day and work-queue mode; asserts date, timezone, backend-derived starts and capacities.
- Asserts the database holds **zero Booking, PaymentAttempt, Escrow and SystemEvent records** after the journey. No Booking POST or payment request is ever issued.
- Fails closed if the database URL, runtime mode, presence of production/provider tokens or HTTP destination differs from the approved localhost-only test fixture. Server and database are destroyed after the Actions job.

## Evidence levels

| Gate | What it proves | Not proved |
|---|---|---|
| Offline UX004 demos + Mobile Cloud CI | Static/source/pure-helper UX and Android compilation | Real signed-in interactions |
| **Free isolated connected API acceptance** | Actual NestJS routing + authorization gate with synthetic local tokens, actual PostgreSQL migrations, published Search records, read-only schedule responses | Live Supabase Auth, hosted HTTPS, Android physical/device UI |
| Future hosted test environment | Authorized nonproduction API, real test sign-in, separate nonproduction DB and test media | Production payments/custody |
| Future approved connected Android preview | Installed Android app, sign-in → discovery → enquiry flow against approved staging | Real money without separately verified provider authority |

**Never describe this ephemeral test runner as a permanent staging server or publicly reachable preview URL.** No new Vercel, Neon, or Supabase project was created by this change. Do not consume Expo EAS credits without further explicit owner approval.

## Further decisions after successful CI

- Resolve or plan around the Vercel preview quota in [issue #176](https://github.com/realxpen/hustle-economy-of-you/issues/176) without modifying production deployment protections.
- Confirm an isolated **free** hosted auth+database project can become available (or find a free self-hosted authentication alternative), with a production-independent HTTPS API. Do not mix test identities with Hustle's existing live Supabase project.
- Only then trigger the separately approved connected Expo build workflow, preserving `EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=false`, and complete real physical Android acceptance from [issue #179](https://github.com/realxpen/hustle-economy-of-you/issues/179).
- Record observed actual workflow run and exact commit before declaring this gate green.

## A3.5 — Connected Expo adapter against actual temporary NestJS (follow-up)

**Status: PENDING exact-head CI until the new run finishes.** The existing API-only sandbox succeeded but previously did not execute the real Expo `mobileApi.searchTab` or `mobileApi.slots` functions. Pure TypeScript source contracts had been run independently with synthetic JSON; they did not prove the mobile HTTP client and real NestJS server agreed at runtime.

The follow-up imports, transpiles and invokes the *actual* unchanged TypeScript modules from `apps/mobile/src/experience/feed-api.ts` and the unchanged `apps/mobile/src/ux004/discovery/` helpers **inside the localhost-only GitHub runner**:

1. The real adapter queries all four typed Search endpoints and Top, with bearer tokens known only to the ephemeral test process. It checks published person/post/service/product cards and API identities against the actual disposable PostgreSQL records.
2. A post's canonical owner is followed to real returned published service and product rows. The pure in-app helpers verify owner `id` matching, offer details and safe canonical web links (without making outside HTTP calls or assuming a configured Web URL).
3. The real mobile `slots` adapter reads an appointment service's returned day/timezone/capacity and a work-queue service's non-slot mode. The actual connected enquiry helper handles safe available slots and timezone labels, not fabricated response data.
4. The adapter rejects invalid bearer and missing bearer credentials. Previous zero-booking, zero-payment, zero-escrow and zero-event assertions still apply. Network access remains guarded to localhost HTTP GET only.
5. This is **not** a React Native emulator, live Expo app installation, native navigation/UI automation, production Supabase auth, public staging URL or a legitimate permission to book anything. No new native packages, cloud services, temporary external secrets or mobile release.

Because this A3.5 slice improves the test runner rather than product code, the same existing `Hustle Free Isolated Connected API Acceptance` workflow is triggered on its PR. Any failure must be fixed on the branch and rerun before manual review/merge. A PASS means the connected mobile **read-model/HTTP adapter** works against our real localhost NestJS API with synthetic scoped identity only.
