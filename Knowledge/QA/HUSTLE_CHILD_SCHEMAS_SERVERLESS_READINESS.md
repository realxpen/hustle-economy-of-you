# Hustle staging — real child schemas and serverless API gate

**Verification date:** 2026-10-22  
**State:** Actual child-branch schemas **APPLIED AND READ-VERIFIED**. Vercel serverless route + environment fix submitted for CI and manual review. **No public connected staging deployment or installed Android evidence yet.**

## Host ownership and immovable safety boundary

- Neon Free project `summer-sound-54525078` remains isolated from Supabase production and all payment integrations.
- Main/primary `staging` branch `br-dawn-hat-zag7c5ae`: still **zero** Hustle `public` tables, **zero** `hustle_auth` tables and nine unchanged Neon-managed `neon_auth` tables. Do not apply schema writes to this branch implicitly.
- **Authorized test child only:** `br-dark-sunset-zay33p1s` named `qa-pr187-real-auth-schema`, project `summer-sound-54525078`, database `hustle_staging`. Its compute endpoint host is `ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech` (no connection secrets should appear in source or issues).

## Actual hosted SQL results and independent SQL verification

Following explicit owner authorization to migrate the disposable child, actual `run_sql_transaction` operations created **all 61 application + Prisma history tables** using 41 source-aligned, staging-projected migrations. All 41 ledger entries are successful, unique, and SHA-256-formatted, and sorted ledger names match all GitHub source migration folder names.

The later [PR #188](https://github.com/realxpen/hustle-economy-of-you/pull/188), **already merged with nine green workflows**, added a separate Expo-compatible Better Auth provider in schema `hustle_auth`, not Neon provider-managed `neon_auth`. Its **one** separate Prisma auth migration has now been applied to the authorized child using transaction-pinned Neon SQL, and its own `hustle_auth."_prisma_migrations"` ledger created. It adds five Better Auth tables plus one auth migration table. Zero auth test users/sessions currently exist.

Verified:
- `public` base tables: **61**; `public."_prisma_migrations"` successful entries: **41**
- `hustle_auth` base tables: **6**; `hustle_auth."_prisma_migrations"` successful entries: **1**
- Neon-managed `neon_auth`: **9** tables, structurally unchanged (**78 columns, 20 indexes**); unchanged columns fingerprint `fd9978e05cc7e1cab96f36635e21305d18c94da559f5c7eeee6257beb7767095`.
- Zero users in both real authentication systems, zero session records, and zero User, Booking, PaymentAttempt, EscrowRecord or SystemEvent financial records in application tables.
- Parent staging verified separately and unchanged.
- These SQL transactions and stored ledgers do **not** yet establish an independently executed `prisma migrate status` or `prisma migrate deploy` command against this real host. No ability to trigger a secret-bearing hosted CLI job is assumed.

## Least privilege correction

The Neon `create_postgres_role` API implicitly grants a new login `neon_superuser` membership, including RLS bypass. An initial API-created `hustle_child_api` role was found to be too powerful and **deleted immediately**; it was never used for a live API connection. The database owner was not permitted to revoke the `neon_superuser` membership in-place. No password was retained or shared.

A new `hustle_child_api` was instead **created via SQL** with `NOLOGIN INHERIT`, membership in `hustle_api` only, and no DB create/schema create rights, no RLS bypass, no `neon_auth` schema usage, and no direct PaymentAttempt read grants. It has controlled application User/Service permissions and scoped SELECT/INSERT/UPDATE/DELETE permissions on the five dedicated `hustle_auth` tables for the eventual Expo Auth session service.

`NOLOGIN` remains intentional: the restricted Vercel project has no usable database secret, and an attempted direct credential transfer between connected services was blocked by a security boundary. Do **not** invent a connection string, log a password, use the database-owner role for the app, or bypass the restriction. The role must only receive a securely provisioned secret through an authorized supported credential workflow before deployment.

## Correct current product auth path

- Actual merged app configuration: `HUSTLE_AUTH_PROVIDER=expo-better-auth`; `ExpoStagingAuthService` checks database-backed, revocable **opaque bearer sessions** in `hustle_auth`. It is NOT the older separate, unused Neon Managed JWT verifier.
- The old source guard allowed the empty **parent** DB hostname and did not pin a branch ID. The reviewed code change now requires `HUSTLE_STAGING_BRANCH_ID=br-dark-sunset-zay33p1s` and the verified child hostname and restricted username `hustle_child_api` for both separate Prisma URLs (`?schema=public` and `?schema=hustle_auth`).
- Production/default runtime continues using Supabase AuthPort. Wrong branch/parent hostname, database-owner username, missing/invalid Better Auth secret, non-allowlisted emails, production provider secrets, and enabled booking/finance flags must prevent the staging API from starting.
- The existing `apps/api/src/main.ts` routes `/api/auth/*` in a long-running Nest process, **but that bootstrap does not execute on Vercel**. The current serverless `apps/api/api/index.ts` needed its **own** pre-Nest validation and a separate `/api/auth/:path*` rewrite/handler using official `better-auth/node`. This PR adds those, preserving the `/api/v1/:path*` route.
- `apps/api/vercel.json` retains `git.deploymentEnabled=false` — no automatic deployment of a production app, and no public API has been verified by this change.

## Required acceptance before public Expo staging preview

1. Merge the exact-head green serverless routing/guard PR only after owner review.
2. Securely provision **a new restricted LOGIN role with secrets entirely inside an approved credential store**. Never use the Neon Console/API-created admin role or application DB owner as a shortcut.
3. Configure **only** the dedicated `hustle-isolated-staging-api` Vercel project with the exact child PostgreSQL URLs, a sufficiently random private Better Auth secret, a private disposable email allowlist and disabled commerce flags. No secrets in GitHub source, PRs or chat.
4. Confirm this standalone Vercel project can deploy under the user's existing plan/rate limit and applicable Hobby testing-only terms; no account plan upgrade or billing changes.
5. Validate a public HTTPS health route and correct 401/404 behavior. Execute a real disposable Better Auth signup/signin and protected Nest API read; invalid/expired/revoked token denial and database identity boundaries must be checked.
6. Then request separate owner approval before consuming Expo EAS preview build credits. Finish a connected physical Android UI test, including logout/expiry. **No booking write, escrow, payout, payment, real user import or provider notifications**.

**This milestone is hosted child database schema readiness, not production readiness.** Parent staging migration, public API deployment and real-device acceptance remain separate from the owner-authorized child migrations.
