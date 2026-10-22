# Hustle — real Neon child-branch migration acceptance boundary

**Date:** 2026-10-22  
**Status:** Real isolated branch **created and verified**; actual application migration SQL **NOT APPLIED** to any hosted branch.

## Source and owner decision

Owner merged [PR #187](https://github.com/realxpen/hustle-economy-of-you/pull/187) on October 22, 2026. The [Neon-compatible projected migrations CI #39764299408](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39764299408) and [Foundation CI #39764299352](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39764299352) both **PASS**. The projection executes **all 41 historical Prisma migrations** in a disposable GitHub PostgreSQL 17 runner, with **17 reviewed provider-specific edits**, no fake Supabase Auth or Storage and 61 resulting public tables.

The owner previously approved a separate free **test-only** environment. Production Supabase and payment infrastructure are out of scope. Full migration SQL includes `DROP POLICY IF EXISTS` and RLS grants/revokes; these are schema modifications requiring an explicit further host-write authorization and a target-specific plan, even for a disposable branch.

## Real Neon resources observed through provider tools

| Item | Verified |
|---|---|
| Project | `summer-sound-54525078` (`hustle-isolated-staging`, Free) |
| Main staging branch | `br-dawn-hat-zag7c5ae` / `staging` (**DO NOT WRITE**) |
| Real disposable child | `br-dark-sunset-zay33p1s` / `qa-pr187-real-auth-schema`, created from staging on October 22 |
| Child state | `ready`, not primary or default |
| Compute | 0.25 CU min/max. A requested custom suspend interval was rejected by Free plan; branch created without overriding provider defaults |
| Database | `hustle_staging` |
| Managed Auth | **9** real `neon_auth` tables, **0** auth users, **0** sessions in both parent and child at observation |
| Application schema | **0** public app tables and no Prisma migration ledger in child at observation |
| Actual schema compare | Child vs parent returned an **empty SQL diff** |
| Existing Supabase production accounts and data | **NOT COPIED OR ACCESSED** |

These results use only provider-owned read-only metadata and SELECT statements. **No application DDL was executed on the real Neon child branch or staging parent.** An empty schema diff before migration confirms the child is a faithful baseline for further work; it is not evidence of a passed hosted migration.

## New fail-closed host-write approval manifest

`scripts/staging/neon-child-branch-approval-contract.cjs` runs **only inside the existing disposable GitHub PG17 projection workflow**, after generating the reviewed staging migrations, before the local `prisma migrate deploy`.

It verifies all 41 original/projected migration hashes, the exact new **child** vs **parent** branch IDs, allowlisted 17 changes and deliberate Storage/duplicate no-ops. It rejects any active SQL referencing `neon_auth`, Supabase Storage/Auth, `DROP TABLE/SCHEMA/ROLE`, non-idempotent policy removal, unexpected LOGIN role, and any provider credentials in the CI environment. It writes a `/tmp` manifest with `deployment_authorized: false` for further review. It **does not** execute provider SQL, pull database passwords, or connect to hosted Neon.

The existing disposable PG17 workflow still fully exercises all staged migrations and RLS grants/denials. A positive CI result is a **source/DDL risk audit plus local migration**, not a hosted Neon migration.

## Next gates — require separate explicit approval

1. Confirm the disposable child branch still has zero real Auth users/sessions and matches the parent's managed Auth schema.
2. Inspect exact migration manifest, role privileges and checksum/ledger semantics; confirm no SQL changes to `neon_auth`. A staged API role can remain NOLOGIN until a separate least-privilege connection-role plan is reviewed.
3. **Only when explicitly approved:** run application DDL on the identified disposable **child branch ID only**, record applied migration ledger/hash and compare managed Auth schema with the parent. Never target parent `staging`, any Supabase production project, or a default branch inferred by omission.
4. Establish a clean rollback/discard path for the child. Deleting a Neon branch is itself a destructive operation requiring owner approval; do not silently remove it.
5. Only after real child-branch acceptance, plan a separately approved schema application to main staging, then a deployed staging API with real Neon JWT and connected Android user journeys. Booking/payment writes remain off; no Expo build or paid resources are implied.

**Usage and cost:** Branch uses the existing Neon Free organization. Free-tier limits still apply; do not upgrade or create paid compute automatically. No GitHub Actions cloud secret or hosted connection string has been introduced.
