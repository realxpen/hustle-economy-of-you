# Neon staging — application-only Prisma migration projection

**Date:** 2026-10-22  
**State:** Proposed, pending exact-head PostgreSQL 17 CI acceptance and owner review. **No hosted Neon migration or login was performed.**

## Source evidence and decision

PR #186 is merged and its isolated PG17 migration rehearsal passed all **41** original production Prisma migrations. The real Neon Free database `hustle_staging` still has **nine Neon-managed Better Auth tables** in `neon_auth` and **no** application tables. Historical migration SQL is tailored partly to Supabase Storage and its Auth/data-access roles. Copying temporary Supabase compatibility mocks from `scripts/payment-sandbox/supabase-compat.sql` to hosted Neon would be unsafe: fake `storage.objects`, `storage.buckets`, and `auth.uid()` are NOT a working media service.

This PR implements a **reviewable, separately generated staging migration history** from the exact source migration files. Production `apps/api/prisma/migrations/**` and Supabase Auth remain untouched. The projected history is not interchangeable with production's Prisma migration checksums: future staging-only migrations must consistently use the projection process, which requires the separate owner-approved deployment gate.

## Exact, allowlisted source transformations

| Historical migration | Staging-only treatment | Reason |
|---|---|---|
| 20260908113729 Hustler proof storage | No-op | Entire file installs Supabase Storage bucket and RLS only |
| 20260910113645 Messaging attachments | No-op | Supabase Storage bucket/policies plus its Storage-only `auth.uid()` helper |
| 20260917123000 Story experience | Preserve all StoryView/Reaction/Reply tables, columns and indexes; omit terminal Storage bucket/policies | Retain app data while leaving actual media provider unresolved |
| 20261007110000 Agent application | Preserve AgentApplication/Proof tables, indexes, constraints, API role/policies; omit terminal Storage bucket/policies | Retain agent application data, not a fictional Storage subsystem |
| 20260917130500 redundant Story RLS | No-op | Previous 20260917124500 already creates identical policies. Original disposable PG16/17 workflow marks this duplicate applied |
| 20260906023000 API role | Change dedicated `hustle_api` role from LOGIN to NOLOGIN in projected SQL only | Staging identity and password must be provisioned/reviewed separately; no unapproved DB login |
| Eleven later migration files with `anon/authenticated` REVOKE | Remove unneeded Supabase role names from privilege revocations; retain `PUBLIC` and applicable `hustle_api` revoke/grants | Neon has no Supabase browser database roles; PUBLIC restrictions and application RLS must remain |

The generator refuses an unexpected new migration count, new Supabase role/Storage/Auth dependency or modifications not in its allowlist. It writes a fresh separate `/tmp/hustle-neon-application-projection` Prisma schema and 41 migration files, plus an audit manifest; production source files are immutable. A new unexpected migration **fails** until its staging projection is reviewed.

## Executable $0 rehearsal

GitHub Actions `hustle-neon-prisma-projection.yml` uses an ephemeral **PostgreSQL 17** service at **127.0.0.1:55441/hustle_neon_projection**, not real Neon credentials. It creates two **fictional** managed-auth tables to simulate the presence of the separately managed schema, captures schema-only dumps before/after, runs the projected Prisma history and asserts:

- All 41 migration ledger entries finish successfully and all expected application tables exist (User/Service/Post/Booking/financial).
- The fictional `neon_auth` schema dump and row remain unchanged.
- No Supabase `auth` or `storage` schema, no `anon` or `authenticated` DB roles, and no pseudo Storage buckets are created.
- Dedicated application role is **NOLOGIN**; no extra provider credentials or public identity access.
- Empty User/Booking/PaymentAttempt/EscrowRecord/SystemEvent rows; application service and security policies present.
- Failure if database hostname, user, password, port, name, flags or external credentials deviate from the disposable test fixture.

This checks PostgreSQL 17 and generated SQL compatibility **only**. A fictional two-table auth schema is not a proof that all nine real Neon Auth tables/permissions survive hosted migration. It creates no actual Neon users or records.

## Still blocked until separate approval

1. **Hosted schema deployment:** confirm Neon database-owner role and `CREATE ROLE` capability, review `hustle_api` membership/privilege strategy and migration checksums, and test on a separate disposable Neon **child branch** that preserves the actual managed Auth schema. Do not apply directly to the `staging` branch from a GitHub PR or without user approval.
2. **Storage:** choose and authorize a real storage/media provider for Hustler proofs, message attachments, stories and agent proofs. Until then, staged media upload/delivery must remain **disabled**, not faked.
3. **Authentication:** verify real disposable Better Auth `/token` issuer/JWKS/audience against the staging JWT port from PR #185. Crypto tests with generated keys alone are insufficient.
4. **Runtime:** configure/test the separate undeployed Vercel API project against the approved Neon schema and staging-only token issuer. Booking writes, wallet, transfers and escrow remain disabled. No Expo APK/EAS credits until a real authenticated target is ready.

Owner review/manual merge required after the exact-head projection CI and Foundation CI turn green. No production migration or hosted DB modification is permitted from this PR.
