# Hustle production activation gate — October 16, 2026

**State: READ-ONLY REVIEW / LOCAL RESTORE INCOMPLETE / NOT APPROVED FOR PRODUCTION WRITES.**

Source of truth is the **existing** Hustle Supabase project `pfgarmyygybmhiiuopym`. Do not create a second paid project, copy live secrets into CI, alter the Supabase migration history, or delete/rebuild any production tables.

## Work completed remotely

- PR #124 merged: additive server-only `MarketplaceCase` / `MarketplaceCaseNote` access migration, **not yet run in production**.
- PR #125 merged: disposable PostgreSQL rehearsal of 27 successful baseline Prisma migrations, nine historically present SQL migrations with missing Prisma history, resolution of those nine in the **sandbox**, and deployment of five new migrations in the sandbox. Rehearsal and Foundation CI passed.
- A read-only production check on October 16 found: 27 successful Prisma history entries, 26 Supabase migration entries, 6 application users, 2 services, 8 bookings, 17 notifications, 4 auth users, 4 identities, 4 Storage buckets with 10 object metadata rows, and 2 successful refund records. No conflicting active refunds. Relevant new Financial Dispatch, MONIFlow observation, and FlowTime revision objects were absent.
- `MarketplaceCase` and `MarketplaceCaseNote` have RLS enabled, but `hustle_api` has no relevant grants until the new migration. Browser roles have no SELECT grants on those casework tables. Actual runtime access is subject to **both** table grants and RLS.
- More than one migration authority is in use. The Supabase and Prisma migration-ledger counts are **not** expected to match.

## Fresh encrypted backup set — reported and verified by owner on workstation

The owner reported four new encrypted exports created on October 16. All four corresponding SHA-256 verification commands reported `OK`. The owner confirmed offsite upload to their private Google Drive backup folder. These are **owner-reported** workstation/Drive results rather than an independent remote download-and-decrypt verification.

| Component | Filename | Result |
| --- | --- | --- |
| Application DB | `hustle-appdb-20261016T115915Z.tar.gz.enc` | Local export/decrypt test passed; checksum OK |
| Auth users/identities | `hustle-auth-20261016T120049Z.sql.gz.enc` | 4 users/4 identities; checksum OK |
| Storage metadata | `hustle-storage-metadata-20261016T120514Z.sql.gz.enc` | 4 buckets/10 object rows; checksum OK |
| Storage bytes | `hustle-storage-20261016T121815Z.tar.gz.enc` | 4 buckets/10 objects, downloaded bytes matched; checksum OK |

**Do not commit, attach, or upload decrypted backup data or credentials to GitHub.** Keep encryption passwords separate. The backup is a **point-in-time** snapshot: if the live app keeps changing, take another just-in-time backup immediately before any subsequently approved production maintenance operation.

## Local October 16 recovery test — current state

The owner created a **separate** local Supabase instance `supabase_db_hustle-restore-fresh-20261016` using Docker. It started empty (0 Auth users, 0 buckets, no app `User` table). The earlier `hustle-restore-lab` Docker volume was preserved.

1. **Application data:** owner reported the October 16 application restore script passed; the restore tool checks expected counts. Do not infer full transaction or FK recovery from this alone.
2. **Auth users and identities:** the owner shared successful local restore output confirming **4 users and 4 identities**.
3. **Storage file restore:** **NOT RUN YET** for the October 16 snapshot. A guarded local Storage restore script is ready on the laptop; expected isolated target `supabase_db_hustle-restore-fresh-20261016`. Do not reuse the older lab's state or delete it.
4. **Storage original object IDs, owners and RLS:** restoration from the separately encrypted Storage metadata snapshot and policy comparison are **NOT verified**.
5. **Real Auth sign-in/session/MFA:** **NOT verified**. Treat the demonstrated recovery as a tested subset, not disaster-recovery completeness.

The owner is temporarily away from the laptop. **Do not attempt local restoration on the hosted production Supabase project.**

## Production prerequisites (not yet authorized)

1. Finish local Storage byte-level recovery and examine metadata/ownership/RLS/paths; distinguish known limitations from recoverable failures.
2. Review exact schema, policies, privileges, indexes, constraints and migration side effects for each of the nine October migrations that exist physically but are absent from Prisma history. Earlier catalog comparisons found 125 columns, 16 enums, 37 indexes, 23 foreign keys and 11 primary keys; these checks cannot prove **full** equivalence. Document any exceptions.
3. Obtain a *fresh* encrypted and offsite-verified backup for the actual maintenance window and capture counts with `scripts/experience/flowtime-readonly-preflight.sql`.
4. Set maintenance window, confirm deployed API version and integration boundaries, define operator identity and rollback/roll-forward plan. No real payment/provider calls in the rehearsal or migration.
5. Obtain **separate explicit production approval** for Prisma ledger changes. Only then use Prisma's supported `migrate resolve --applied <exact-migration-name>` for each of the nine migrations proven equivalent. Never hand-edit either history table. Preserve Supabase's independent ledger.
6. Validate Prisma migration status showing exactly the five truly missing migrations. **Never run `migrate deploy` against live before this step**.
7. Obtain explicit production DDL approval. Apply in dependency order: `20261013090000_financial_durable_dispatch`, `20261013131500_moniflow_sandbox_receipt_observation`, `20261015122500_flowtime_adaptive_booking`, `20261015132000_flowtime_revision_access`, `20261016120000_marketplace_casework_api_access`.
8. Run post-change RLS/privilege checks and booking/financial regression QA; separately approve and trigger the manual `DEPLOY` workflow for API, then Web, only after DB compatibility is proven.

**Stop condition:** Any count drift, missing grant, ledger mismatch, partial restore, refund uniqueness issue, or ambiguous migration equivalence requires investigation, not a force migration, data deletion, or blind retry.

## Historical notes

`Knowledge/QA/FLOWTIME_EXISTING_SUPABASE_ACTIVATION.md` describes the *October 15* audit and correctly recorded that **no backup was available at that earlier point**. Do not read that dated statement as the current October 16 backup status. `Knowledge/QA/PRISMA_LEDGER_RECONCILIATION_REHEARSAL.md` was drafted as a proposed PR and the rehearsal was subsequently **merged and passed** in PR #125. This checklist is the current progress ledger; no older source is silently overwritten.

## AED alignment

The Build → System Activation boundary requires demonstrated backup recoverability, database ledger consistency, finance safety and accountable production approval. A GitHub PR merge is not a live database deployment.
