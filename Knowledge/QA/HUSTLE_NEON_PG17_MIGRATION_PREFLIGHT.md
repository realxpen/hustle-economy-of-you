# Hustle — Neon Free staging PostgreSQL 17 schema rehearsal

**Date:** October 22, 2026  
**Target:** Newly created, isolated `hustle-isolated-staging` Neon Free project (PG17), **without connecting or migrating it in this slice**.

## Verified actual Neon database state

Read-only queries made against **project `summer-sound-54525078`, branch `br-dawn-hat-zag7c5ae`, database `hustle_staging`** show:

- PostgreSQL **17.11**.
- Public application schema has **zero** base tables and **no** `_prisma_migrations` ledger.
- Separate managed `neon_auth` schema has **nine** tables, including `user`, `session`, and `jwks`.
- Managed Better Auth integration is provisioned and available under its own Auth base URL. **No disposable user has been signed in or any real token tested.**

These are read-only observations. No production Supabase database, real data, Neon Auth user, payment service or publicly hosted API was changed.

## Why schema cannot simply be copied or blindly deployed

The actual `apps/api/prisma/migrations` contains **40** chronological migration directories (last: 2026-10-16 marketplace casework API access). They create Hustle's application tables and operational `hustle_api` database role/RLS policies.

Some historic SQL assumes **Supabase-specific** database roles, `auth.uid()`, `storage.*` objects and storage policy management. Those are not automatically present in an independent Neon PG17 project. The existing passing PostgreSQL 16 offline runner creates a *deliberately fictional* compatibility fixture guarded to local `hustle_payment_sandbox`, and resolves one historic overlapping Story RLS migration in its disposable Prisma ledger. That fixture **must not** be applied unmodified to Neon staging: its credentials, object permissions, storage mocks and role choices need separate review.

The live Neon `neon_auth` tables must remain managed by Neon; Prisma application migrations must not overwrite, impersonate, or reset that schema. The current Prisma `schema.prisma` targets the application `public` schema.

## This PR: executable, free isolated PG17 rehearsal

Workflow: `.github/workflows/hustle-neon-pg17-migration-preflight.yml`.

1. Starts a new PostgreSQL **17** service on GitHub Actions, bound to `127.0.0.1:55440/hustle_payment_sandbox`. Runtime checks refuse every remote hostname, other DB/port/credential and any Supabase, Neon auth or payment-provider secrets.
2. Adds two **fictional** `neon_auth` tables to simulate a pre-existing isolated auth schema, with one clearly synthetic row. This is not a real Better Auth clone and tests no login.
3. Uses the already approved **local-only** Supabase compatibility fixture. It is guarded by database name and remains in the temporary job.
4. Resolves the historic Story security ledger overlap **only in this temporary database**, then runs the entire source-controlled Prisma migration stack with `prisma migrate deploy`.
5. Asserts every source migration has a successful ledger row, expected User/Post/Service/Product/Booking and financial tables exist, users/bookings/payments/escrow/events remain empty, and required API database role exists.
6. Diffs a schema-only dump of the fictional `neon_auth` schema before and after migration, asserts its synthetic record is unchanged, and rejects direct `anon` role read access to application user tables.
7. Reports the result as **local PG17 migration compatibility** only, never as deployment to real Neon. The GitHub runner and its container are deleted afterward.

## Deferred owner-reviewed Neon deployment gates

- [ ] PG17 local rehearsal PASSES exact-head CI.
- [ ] Design an application-only Neon-compatible migration bootstrap that preserves Neon Managed Auth, makes deliberate role/RLS decisions and does **not** install fake Supabase Storage/Auth objects in the actual Neon database.
- [ ] Test that bootstrap and full stack against a disposable copy/branch with no real Neon auth users; inspect role privileges, Postgres grants and schema comparison.
- [ ] Make any actual write to the new hosted staging database **only after an explicitly reviewed migration plan and owner authorization**. The user has approved the free isolated test environment, but that does not waive migration review or production-safety gates.
- [ ] Validate real Neon Managed Auth JWT issuer, audience, signature and expiry using separately approved disposable users. PR #185 tested locally generated cryptographic tokens only.
- [ ] Deploy the isolated API and staging-only mobile login, then finish real Android UX acceptance. No Expo EAS build or production rollout is authorized by this rehearsal.

See [issue #179](https://github.com/realxpen/hustle-economy-of-you/issues/179) for signed-in staging acceptance and [issue #176](https://github.com/realxpen/hustle-economy-of-you/issues/176) for the separate Vercel preview quota.
