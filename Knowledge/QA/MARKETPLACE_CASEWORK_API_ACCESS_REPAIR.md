# Marketplace casework API-only access repair — preparation

Status (2026-10-16): **GitHub PR only; no live Supabase DDL, Prisma migration resolve or production deployment**.

## Why

The Phase 19C Marketplace casework migration (`20261008011000_phase19c_marketplace_casework`) enables RLS and removes browser-role access, but never grants the server database role `hustle_api` the privileges/policies that the admin casework API requires. Read-only production checks on 2026-10-16 confirmed `MarketplaceCase` and `MarketplaceCaseNote` have RLS enabled, no `hustle_api` table privileges or RLS policies, and no `anon`/`authenticated` privileges. Both currently have zero rows.

The Nest `MarketplaceCaseService` uses Prisma for `findMany`, `findUnique`, `groupBy`, `create`, and `updateMany` on cases, and `create` plus nested reads of case notes. Its controller uses `AuthGuard` and `AdminGuard`. RLS policies scoped to the server-only `hustle_api` role therefore do not replace application authorization or grant browser access.

## Repair (additive migration)

`apps/api/prisma/migrations/20261016120000_marketplace_casework_api_access/migration.sql`:

- Reassert RLS on both tables.
- Revoke `PUBLIC`, `anon`, and `authenticated` direct table privileges.
- Grant `hustle_api` **SELECT/INSERT/UPDATE** on `MarketplaceCase` and **SELECT/INSERT** on append-only `MarketplaceCaseNote`, with dedicated matching RLS policies. Never grant DELETE or client direct access.
- Does not add/remove/change case rows, write financial records, or invoke any provider.

## Test

The `Isolated Payment Sandbox` GitHub Actions job applies all Prisma migrations in throwaway PostgreSQL, then runs `scripts/experience/casework-access-check.sql`. It asserts RLS, least-privilege table access, five expected RLS policies, no browser-role grants, and SQL SELECT/UPDATE/EXPLAIN INSERT under `hustle_api`. The test refuses to run outside the `hustle_payment_sandbox` database. **Do not claim CI passed until GitHub checks complete successfully.**

## Production rollout boundary

Do **not** run Prisma migrate deploy on the live Hustle project yet. Nine October Prisma migrations have their core schema in Supabase without successful entries in `_prisma_migrations`; replaying them could fail on existing objects. Complete and review object-equivalence evidence, reconcile each valid entry with the supported Prisma `migrate resolve --applied` workflow, and test the remaining Financial Dispatch, MONIFlow, FlowTime and this access repair in dependency order on an isolated database.

A verified encrypted backup and isolated application/Auth/Storage smoke tests exist as of 2026-10-16, but they are **not** complete disaster-recovery coverage (sign-in, original Storage IDs/ownership, and policy restoration need additional validation). Take a fresh backup immediately before any separately approved production DDL; preserve independent Prisma and Supabase histories. Deploy the API only after production schema validation. No approval for finance execution or paid Supabase resources is implied.
