# Isolated Payment Sandbox — Phase 20B

Status: Isolated GitHub Actions integration checks PASSED on 2026-10-09 (run `37947556127`; full signed PAID→COMPLETED lifecycle). Final mask-security rerun and PR merge pending. Not a hosted production or Vercel Preview payment environment.
Date: 2026-10-09

## Purpose

Test the **actual** Phase 13 payment gateway and Phase 20B Order notification flow, including signed webhook delivery, double-entry ledger, inventory, refund/cancellation guardrails and buyer/seller notification isolation, without touching a single production Order, wallet, webhook or PaymentAttempt.

## Hard isolation

- Uses **disposable PostgreSQL 16**, database name `hustle_payment_sandbox` on `127.0.0.1:55439`. No Supabase project, cloud database, production URL or shared Docker volume.
- Local Docker Compose is `docker-compose.payment-sandbox.yml` and uses its own `sandbox_payment_db` volume. The local run **tears down the volume** afterward.
- CI workflow `.github/workflows/payment-sandbox.yml` uses an ephemeral PostgreSQL GitHub Actions service and fresh database. No project secrets, production credentials, or Vercel deployments are referenced.
- Sandbox bootstrap SQL creates `anon` and `authenticated` NOLOGIN roles to satisfy migration RLS references. It is database-name guarded. The real migrations create their own `hustle_api` role.
- Runs real Prisma migrations, not a mocked schema.
- The test runner refuses to start unless the `DATABASE_URL` is *exactly local* `postgres@127.0.0.1:55439/hustle_payment_sandbox`. The webhook HMAC secret is randomly minted each run and never committed.
- A real NestJS HTTP process starts bound only to `127.0.0.1` on a random port for webhook ingress. Business actions use **actual Nest-provided** PaymentService, CommerceService, FulfillmentService, NotificationsService with locally seeded in-memory identity subjects mapped to local User rows. This checks domain service authentication/authorities, not live Supabase sign-in.
- No production API or Web deployment, no hosted branch provisioning, no real PSP or external payment network calls.

## Run locally

Requires Node 22+, Docker with Compose, and `npm ci` at monorepo root.

```bash
npm ci
npm run sandbox:payments
```

This starts isolated database, bootstraps roles, applies migrations, builds API, runs the complete signed payment/Order test and tears down the database/volume. If interrupted, execute:

```bash
docker compose -f docker-compose.payment-sandbox.yml down -v
```

Or use **GitHub Actions → Isolated Payment Sandbox → Run workflow**. The PR workflow also runs when sandbox or payment-relevant paths change, with no credentials.

## Historical migration compatibility

One hosted migration (`20260908113729_phase3_hustler_proof_storage`) targets managed Supabase `storage.buckets`, `storage.objects`, `storage.foldername()` and `auth.uid()`. Bare PostgreSQL does not ship these objects, so `supabase-compat.sql` creates **schema-only local substitutes** solely for applying RLS policies; no real Storage service or authentication endpoint is simulated.

Two repository migrations overlap: `20260917124500_phase16b_story_rls_hardening` defines all four Story API policies, and `20260917130500_phase16b_story_rls_hardening` recreates those identical grants/policies without dropping them. The disposable sandbox marks the later duplicate as already represented in its **isolated Prisma migration ledger** before applying the remaining migrations. No production migration file is altered; no production migration ledger is touched.

## What the automated test exercises

1. Creates disposable buyer, seller with ACTIVE Hustler capability, published professional profile, tracked physical Product; Buyer puts Product in Cart and checks out. Seller receives one PENDING Order notification. No inventory deduction while pending.
2. Payer initializes a real HUSTLE_SANDBOX PaymentAttempt through PaymentService. Wrong payer denied; no PAID notification before verified funding.
3. Sends an **unsigned** local HTTP webhook and checks 401/no mutation; sends a valid **HMAC-SHA256 signed** `payment.succeeded` webhook and checks PaymentAttempt confirmation, Order PAID, stock decremented once, seller receives one PAID alert.
4. Replays the signed webhook and payment initialization to verify idempotency; checks one capture LedgerTransaction, two balanced postings and no duplicate notification or second inventory deduction.
5. Confirms PAID Order cannot be cancelled, buyer cannot act as seller, then transitions through PROCESSING → SHIPPED → DELIVERED → COMPLETED with the actual FulfillmentService.
6. Asserts Buyer receives exactly PROCESSING, SHIPPED, DELIVERED and Seller receives exactly PENDING, PAID, COMPLETED. Wrong recipient gets none. Reads authenticated inbox, verifies unread count and recipient-isolated mark-read; invalid repeated state transitions denied.
7. CI red means **not accepted**, even if typecheck/build passed. A successful run is **isolated integration evidence**, not a user-facing hosted preview nor real payment provider acceptance.

## Out of scope / future steps

- A continuously running **hosted** preview environment with separate Supabase branch requires billing confirmation. It is **not created** by this workflow.
- A hosted disposable Supabase Auth deployment or separate Vercel preview URL is **not created**. The runner executes a local-only Nest API and verifies the public webhook through HTTP.
- Payouts, refunds, actual bank movements, external payment provider integrations and cross-user browser sessions are not simulated here.
- Sandbox success does not authorize production money movement. Any proposed hosted Supabase branch, Vercel project or production financial setting change requires separate owner approval and explicit cost review.

## Related decisions

ADR-0012 payment authority; ADR-0048 Phase 20B notification recipient/state mapping. Live production Phase 20B remains **PARTIAL** until owner-facing financial tests are independently accepted. The isolated CI result can close the *sandbox-only* PAID→COMPLETED notification integration subgate, not the full production gate.
