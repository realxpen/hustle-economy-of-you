# Five pending SQL files on a disposable native restore

Date: 2026-10-21. Preparation only until the actual protected run is inspected.

First actual run [39680532252](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39680532252) stopped at the first pending CREATE with SQLSTATE 42501; cleanup passed. The native archive does not carry database ownership because it was captured without `--create`. Its new initdb target belonged to `supabase_admin`, while read-only source metadata independently confirmed database `postgres` belongs to `postgres`, and schema `public` belongs to `pg_database_owner`. The correction changes only the owned disposable database owner to the verified source owner, retaining imported role attributes and schema grants. A generated non-superuser negative control must fail before that correction and pass afterwards. No passing actual rehearsal is inferred from the failed run.

## Completed prerequisites

Actual native backup login/file access passed in run `39650103698` attempt 3. Actual historical schema comparison then passed all nine groups in [run 39677312520](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39677312520), on `752e2a89cca7de2ae23b6bf5d39a54e63da1abf7`. Independently verified report JSON SHA-256: `c74e2ae4eba05fa47cd1d06325f2f35f0505787f646273e7f0d1a8075cf2d8bf`; ZIP SHA-256: `3fdd9071e11eee76fd899c240d46954f9aacb3ba824f9775087e16e04bd5c7c0`. No differing objects or fields remained after the reference reproduced and explicitly compared the project's verified Supabase default grants. These are completed milestones, not another owner setup task.

## Requested next step

The owner authorized testing the five genuinely pending SQL migrations on a fresh disposable restore. This procedure executes their original SQL, with exact reviewed SHA-256 allowlists, in one transaction inside the existing guarded Docker boundary:

1. Financial dispatch plus active-refund partial uniqueness.
2. MONIFlow sandbox receipt observation.
3. FlowTime additive Service/Booking fields and schedule revisions.
4. FlowTime API-only revision access.
5. Marketplace casework API access.

It does not repair either migration ledger or run Prisma deployment. The separate generated Prisma ledger CI exercises the simulated 27→36→41 sequence; this actual-data procedure instead tests the five physical SQL effects and preserves both histories exactly. A result must distinguish these two scopes.

## Execution and checks

- Use only main, manual confirmation `REHEARSE_SAVED_MIGRATIONS`, the protected `hustle-cloud-recovery` environment, GitHub-hosted Linux and the exact selected checkout. A generated contract must pass first. Reuse the existing Drive reader/native passphrase; no owner account password or production connection is needed.
- Download and verify the same exact eleven encrypted files and original native restore report. Strictly restore the October 20 native archive to a new owned, network-disabled PostgreSQL 17 container. No host ports or host data mounts are introduced.
- Recompute all nine historical schema matches, including role/default grants, before any pending SQL. Check pending objects are absent and that original refund rows do not violate the new uniqueness rule. A mismatch stops without deleting or repairing data.
- Before that comparison, reproduce the independently verified database ownership on the owned restore only. Require the initial database/schema owners to match the known initdb/import setup; do not elevate `postgres` or add schema privileges. This corrects the ownership omitted by the native archive rather than suppressing a permission failure.
- Enumerate original ordinary/partitioned tables in `public`, `auth`, `storage` and `supabase_migrations`. Record their original columns. PostgreSQL hashes each original projected row, sorts the hashes, and computes a SHA-256/count receipt per table. Private rows never leave the database; comparison receipts stay in process memory and are excluded from artifacts. New fields are checked separately, so intentional column additions do not conceal changed original values.
- Apply all five reviewed SQL files in one transaction as the original owning role. Stop on any SQL error. Compare every affected catalog object to the independently generated reference and reject changes to unrelated snapshot objects. Rehash all original tables and compare both ledgers byte-for-byte through JSON values. Original Storage catalog and capture counts must still match.
- Verify new Service/Booking defaults on the actual existing rows (nonempty dataset required), and that the three new tables start empty.
- Clone the migrated database inside the same owned container into the fixed disposable `hustle_payment_sandbox` name. Run the existing casework/FlowTime grant/RLS assertions with their original database-name guard intact. Insert generated financial/receipt probes only into this local clone, prove browser roles see zero and the API role sees one, and roll back. No provider calls or financial settlement occur.
- Remove the owned container, its local test clone and encrypted staging copies before publishing the aggregate result. No raw errors, row hashes, account IDs, SQL definitions or private files are published.

Generated cloud testing exercises these same helpers and checks that changing a generated original row is detected even when its table count is unchanged. Offline unit tests cover SQL hash drift, original-column projection/escaping, source incompatibility, unexpected schema changes, non-vacuous defaults, access leakage, main/revision/job guards, cleanup on historical mismatch, and report exclusions.

## Scope after a pass

A pass proves that the five pinned SQL files applied to this saved dataset, preserved all original projected row contents and both histories, produced expected schema/defaults, and passed the specified local database role checks. It does not prove Prisma resolution/deploy on actual restored history, application booking capacity/concurrency, post-migration Auth/Storage API behavior, all user journeys, full disaster recovery or production readiness. File bytes are not recovered again in this run; the earlier native access result remains the evidence for those ten files.

Production DDL/history changes, deployment and provider activation retain separate release gates. Before any rollout, revalidate current source metadata/data and prepare an appropriately fresh pre-change backup and explicit migration/release plan.
