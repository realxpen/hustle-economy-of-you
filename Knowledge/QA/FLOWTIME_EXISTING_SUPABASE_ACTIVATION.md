# FlowTime — Existing Supabase activation & migration-ledger reconciliation

Date: 2026-10-15
State: **READ-ONLY PREPARED / NOT ACTIVATED**. No database DDL, Prisma migration changes, production API redeployment, or fund movement executed in the active Supabase project.

## Current preparation record — 2026-10-21

Latest evidence: [actual native backup access run 39650103698 attempt 3](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39650103698/attempts/3) **PASSED**. Ten original file hashes/API reads, one restored account login/refresh, six private proof permission checks, original metadata/policy preservation and cleanup are verified. Older private-access-pending statements below are superseded. [The saved native migration audit](HUSTLE_NATIVE_MIGRATION_AUDIT.md) is next; actual schema comparison, restored-data migration rehearsal and production activation remain pending. No live ledger repair or DDL is authorized.

The fresh October 20 encrypted backup and local native database/file restore have **passed**; see the exact set/report fingerprints and limitations in [the recovery plan](HUSTLE_FULL_RECOVERY_AND_ACTIVATION_PLAN.md). Do not repeat the older backup instructions below to restart this stage. The separate real login/private-proof API rehearsal has **not run** because its private credentials are not connected to an approved runtime. The owner requested agent-run engineering checks; use [the generated cloud contract](HUSTLE_AUTOMATED_RECOVERY_CHECKS.md) and continue independent review rather than assigning terminal work. Full recovery and production activation remain unverified.

A new metadata-only query ran inside `BEGIN READ ONLY` against the existing Hustle project. It read migration names/status, object/column existence and aggregate role privileges, without reading application/Auth user rows or changing the source. Results:

- PostgreSQL `170006`; Prisma has **27 successful migrations, 28 total rows** including one rolled-back attempt. Supabase still has **26 entries**. Preserve these independent ledgers.
- At repository revision `d9c6b02a8508ed93c00c7ef4dcce96378832615b` there are **41 Prisma migration directories**, of which **14** have no successful Prisma stamp. Repository comparison from PR #141's merge to this revision shows no API/migration changes.
- `FinancialDispatchCommand`, `MoniflowSandboxReceiptObservation` and `BookingScheduleRevision` are absent. Checked FlowTime Service columns (`bookingMode`, `bookingTimezone`, `resourcePoolKey`, `parallelCapacity`, `weeklyHours`) are absent.
- `MarketplaceCase` and `MarketplaceCaseNote` exist with RLS enabled, but `hustle_api` has no SELECT/INSERT/UPDATE table privileges on either. Browser roles have no SELECT privileges. The current rollout must account for the pending casework access follow-up as well as the four previously listed migrations.

| Prisma migration without a successful stamp | Review result / remaining proof |
| --- | --- |
| `20261007110000_phase18a_agent_capability_foundation` | Historical core-object presence only; exact SQL equivalence pending |
| `20261007114500_phase18b_agent_relationship_permissions` | Historical core-object presence only; exact SQL equivalence pending |
| `20261007123000_phase18b_relationship_revoker_index` | Historical core-object presence only; exact SQL equivalence pending |
| `20261007133000_phase18c_agent_assisted_onboarding` | Historical core-object presence only; exact SQL equivalence pending |
| `20261007233000_phase18e_delegated_message_actor` | Historical core-object presence only; exact SQL equivalence pending |
| `20261008011000_phase19c_marketplace_casework` | Historical core-object presence; case/note tables reconfirmed; exact equivalence pending |
| `20261008085000_phase19d_marketplace_content_enforcement` | Historical core-object presence only; exact SQL equivalence pending |
| `20261008114000_phase19e_enforcement_appeals` | Historical core-object presence only; exact SQL equivalence pending |
| `20261009130000_phase20a_notification_inbox` | Historical core-object presence only; exact SQL equivalence pending |
| `20261013090000_financial_durable_dispatch` | Core table absent; no resolution or SQL apply performed |
| `20261013131500_moniflow_sandbox_receipt_observation` | Core table absent; no resolution or SQL apply performed |
| `20261015122500_flowtime_adaptive_booking` | Revision table and checked Service policy columns absent |
| `20261015132000_flowtime_revision_access` | Revision table absent; depends on FlowTime schema |
| `20261016120000_marketplace_casework_api_access` | Required API grants absent; follow-up omitted from the older rollout list |

This is an inventory, **not** a per-migration equivalence certificate. Do not stamp any of the nine historical candidates from table presence, ledger names or this note. Full comparisons and any proposed repairs must be tested on the restored copy before a separate release review. API/Web deployment and production DDL remain paused; this preparation does not affect the independent offline mobile-demo work.

## Historical October 15 audit and October 19 smoke-test update

Evidence update (2026-10-19): Owner-triggered [recovery run 39241163040](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39241163040) passed application/Auth restore, all 10 Storage file byte readbacks and the earlier metadata count check in disposable Supabase. The backup statements below describe the October 15 audit, before that test. The passing smoke test is partial and does not clear this activation gate: full original metadata/access recovery, real Auth behavior, a coordinated snapshot and migration equivalence remain unverified. Follow [the recovery and activation plan](HUSTLE_FULL_RECOVERY_AND_ACTIVATION_PLAN.md); revalidate the historical production observations below before preparing exact rollout SQL.

## Owner choice
Keep the EXISTING Hustle Supabase project (ref: `pfgarmyygybmhiiuopym`) and existing Vercel projects. No new paid project or paid branch. User approved reconciliation/preparation, **not an unverified destructive/migration-history repair**.

## Facts observed with read-only Supabase queries
- Existing project reports ACTIVE_HEALTHY, about **17 MB**. 6 User records, 2 Service records, 8 Booking records and 17 Notification records at time of audit (counts change).
- The two independently managed ledgers are **not expected to have identical versions**:
  - `public._prisma_migrations`: 27 successful migrations through `20260918110000_phase17b_native_live_media`. One older rolled-back attempt exists for `20260917124500_phase16b_story_rls_hardening` alongside a successful attempt.
  - `supabase_migrations.schema_migrations`: 26 entries through `20261009123129_phase20a_notification_inbox`.
- GitHub `apps/api/prisma/migrations/` has **39** migration directories including FlowTime. **12** were not stamped successful in Prisma at this audit.
- Of those 12, the following **nine appear structurally present** (at least their core tables/columns): `20261007110000_phase18a_agent_capability_foundation`, `20261007114500_phase18b_agent_relationship_permissions`, `20261007123000_phase18b_relationship_revoker_index`, `20261007133000_phase18c_agent_assisted_onboarding`, `20261007233000_phase18e_delegated_message_actor`, `20261008011000_phase19c_marketplace_casework`, `20261008085000_phase19d_marketplace_content_enforcement`, `20261008114000_phase19e_enforcement_appeals`, and `20261009130000_phase20a_notification_inbox`. **Presence is not proof of complete SQL-equivalence**; audit actual columns, indexes, constraints, functions, policies and storage buckets before resolving ANY Prisma ledger entry.
- These three later Prisma migrations have **missing core objects**:
  - `20261013090000_financial_durable_dispatch` — no `FinancialDispatchCommand` table.
  - `20261013131500_moniflow_sandbox_receipt_observation` — no `MoniflowSandboxReceiptObservation` table.
  - `20261015122500_flowtime_adaptive_booking` — neither `Service.bookingMode` nor `BookingScheduleRevision` is present.
- **This follow-up PR adds a fourth not-yet-applied migration**: `20261015132000_flowtime_revision_access` securing the revision table for `hustle_api` only.

## Critical runtime security correction
Hustle's normal API connects as `hustle_api`, a role that **does not bypass RLS**. Existing Booking/Service/Notification tables deliberately grant that role and define API RLS policies. FlowTime PR #122 created `BookingScheduleRevision` without the analogous grants/policies. Extension creation would otherwise fail with permission denied. The follow-up migration:
- Enables RLS on `BookingScheduleRevision`.
- Revokes all direct access for `PUBLIC`, `anon` and `authenticated`.
- Grants only `SELECT, INSERT` to `hustle_api` with separate RLS policies.
- Is verified in the isolated payment-sandbox PostgreSQL job against a real database, not only through source matching.

## Historical backup instructions — superseded by the October 20 native capture

These commands describe the earlier proposed CLI capture, not the format of the completed October 20 native set. Preserve them as historical context; use the completed evidence and remaining gates in the recovery plan instead of asking the owner to create the same backup again.
The Supabase organization is on **Free**, which does not include automatic managed daily backups or PITR. No backup export or restore test has been completed in this audit. Database access via the current connector exposes safe SQL reads/migrations but no supported backup-file export; **do not treat read-only inspection as a recoverable backup**.

From a trusted local workstation with Supabase CLI and Docker installed, use the database connection supplied privately in the Supabase dashboard's **Connect** UI. Never paste it into GitHub, ChatGPT, logs or PR comments. Generate protected local backups **outside the repository**. Based on Supabase's published restore guide:

```sh
# Set SUPABASE_DB_URL securely in your local terminal (from Dashboard > Connect).
# Backups contain sensitive user/transaction data; never commit these files.
umask 077
mkdir -p "$HOME/hustle-db-backup-pre-flowtime"
cd "$HOME/hustle-db-backup-pre-flowtime"
supabase db dump --db-url "$SUPABASE_DB_URL" -f roles.sql --role-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f schema.sql
supabase db dump --db-url "$SUPABASE_DB_URL" -f data.sql --use-copy --data-only
supabase db dump --db-url "$SUPABASE_DB_URL" -f migration_history_schema.sql --schema supabase_migrations
supabase db dump --db-url "$SUPABASE_DB_URL" -f migration_history_data.sql --use-copy --data-only --schema supabase_migrations
test -s schema.sql && test -s data.sql && sha256sum *.sql > manifest.sha256
sha256sum -c manifest.sha256
```

**Important:** Supabase CLI excludes some Supabase-managed schemas by default; Auth and Storage configuration and actual Storage file objects need separately documented recovery. Check the Supabase backup/restore documentation for your recovery requirements. Offsite-encrypt the snapshot, ensure files are nonempty, and ideally restore into a disposable database to prove recoverability **before touching production**.

Official guides:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore
- https://supabase.com/docs/reference/cli/introduction

## Production migration rollout (NOT performed)
1. Owner verifies the encrypted logical backup and recovery procedure, confirms acceptable maintenance window, and separately approves production DDL. Capture before counts and schema signatures with `scripts/experience/flowtime-readonly-preflight.sql`. No secrets in CI logs.
2. Perform an **exact SQL object-by-object audit** of each of the nine physically-present-but-unstamped October Prisma migrations. Do not stamp a migration just because a table name exists; repairs must be explicitly documented in separate reviewed SQL. Preserve the separate Supabase history; do not force the two ledgers to match or hand-edit `_prisma_migrations`.
3. For each migration proven equivalent to its recorded schema, use Prisma's documented `migrate resolve --applied <exact_name>` from an approved operator session; record what was verified. Do not use `migrate resolve` on missing objects or failed/partially applied migrations.
4. Run `npx prisma migrate status --schema=apps/api/prisma/schema.prisma` to confirm only genuinely missing migrations remain. **Never execute plain `prisma migrate deploy` until this gate is satisfied**: it could replay Phase 18/19/20 against existing objects.
5. Then, with the verified pre-change backup available and maintenance/monitoring in place, apply only outstanding SQL in dependency order. The current inventory is durable dispatch → isolated MONIFlow receipt observation → FlowTime schema → FlowTime RLS access hardening → marketplace casework API access. The casework follow-up requires equivalence/repair of the original Phase 19C objects first. Revalidate this list against the exact release revision and target; it is not executable rollout approval. The proposed pathway is Prisma migrate deploy **after** proper ledger reconciliation and a separate owner-approved release. Both funding and sandbox receipt features must remain isolated; this does not authorize real provider transactions.
6. Confirm both ledgers and actual schema after apply. Verify `hustle_api` INSERT/SELECT permission and RLS, and that `anon`/`authenticated` lack direct access to `BookingScheduleRevision`. Verify casework API grants/policies and append-only notes, with no browser-role access. Run authenticated two-account acceptance and real PostgreSQL concurrent last-slot acceptance, including late-work notifications.
7. Deploy API **after** schema validation (not before). Deploy Web afterward. Existing Vercel API/Web production deployments were previously behind merged PR #122; do not assume the app automatically updated. Confirm deployed Git SHA, environment mapping and payment sandbox boundaries. The existing manual production deployment workflow uses a deliberate `DEPLOY` approval.
8. Monitor errors and booking statuses. For rollback, revert the API/Web deployments first to compatible versions; keep additive columns/data intact. Dropping columns/enum/history is **not** a safe automatic rollback. Recover from the encrypted tested backup only under a deliberate restoration incident plan.

## Explicit non-completions
- The fresh backup and native database/file restore passed separately on October 20. Actual Auth login/refresh, Storage API owner/other-user access and full recovery remain unverified.
- No migrations are marked as applied, in either ledger.
- No Supabase DDL or live booking writes have been executed.
- No production Vercel deployment or switch of domains has been executed.
- Full object-level equivalence of the nine physically-present Prisma migrations remains to be signed off; completing the technical reconnaissance alone is not license to run `prisma migrate deploy`.

## AED
Build → Shadow requires a safe, reproducible activation boundary and accurate persistent knowledge. Never sacrifice migration or payment integrity for a demo shortcut.
