# Hustle — Next recovery and activation milestones

Prepared: 2026-10-19. Updated: 2026-10-21. Status: **FRESH BACKUP AND NATIVE DATABASE/FILE RESTORE PASSED; AUTH/ACCESS AND PRODUCTION ACTIVATION REMAIN PENDING**.

## Completed baseline

The owner completed a fresh encrypted capture and the native database/file restore on 2026-10-20. The existing backup and successful test are completed work, not instructions to start over.

| Evidence | Confirmed result |
| --- | --- |
| Fresh backup set | `hustle-20261020T111134Z-9f73a014`; encrypted capture completed, uploaded to the private backup folder, and uploaded file bytes/checksums verified |
| Inventory SHA-256 | `e7f947778dfd1879f95eacfc320e29f5067a88059e061292a870ae7b226371c4` |
| Actual native restore | Owner ran `hustle-restore-test-v2.py`; roles and the native database imported into a new isolated PostgreSQL 17 target |
| Database comparisons | Application counts, Auth row counts and both migration-row counts matched; 28 Prisma rows include the historical rolled-back attempt, not 28 successful migrations; Supabase has 26 entries |
| Original Storage metadata | IDs, ownership, bucket settings and object metadata matched; only `last_accessed_at` was excluded from the comparison |
| Recovered files | All 10 original files recovered and every byte digest checked |
| Cleanup | Temporary database and recovered files removed |
| Verified report | `hustle-20261020T111134Z-9f73a014-restore-19bd1540.json`; uploaded report's exact bytes independently matched terminal SHA-256 `3746cca5c372e89eb9afb27153b2e57c10653490794700a5dc897733d6344920` |
| Remaining exclusions | Real Auth login/refresh, real Storage API access, external configuration and full disaster recovery remain unverified; capture was non-atomic |

The older owner-triggered [run 39241163040](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39241163040) remains valid historical evidence for the October 16 archives. Its upload-only metadata limitations do not describe the newer native restore. See [the legacy recovery record](HUSTLE_CLOUD_BACKUP_RECOVERY.md).

## Current agent-run handoff and private-access limitation

- The private login/proof rehearsal is prepared but **NOT RUN**. The owner requested agent-run engineering rather than terminal instructions. The [main-only private cloud procedure](HUSTLE_PRIVATE_NATIVE_CLOUD_CHECK.md) restores the exact saved set and verified report, reuses the existing Drive reader, and needs three environment secrets entered directly through GitHub's browser settings. Run generated contracts through [the GitHub automation](HUSTLE_AUTOMATED_RECOVERY_CHECKS.md); leave actual private acceptance pending secure setup and the deliberate private run. Never request these secrets in chat or attach them to PR checks.
- This check targets one original account's sign-in/refresh and original private-proof owner/other-user access. Even a pass would not prove all accounts, MFA/OAuth, message-participant rules, all application flows or full disaster recovery.
- Continue repository SQL review and approved read-only schema/ledger inventory independently. Exact equivalence and migration rehearsal still need the restored copy; an inventory alone does not clear them.
- Do not repeat the completed capture/basic restore solely because the next check is pending. A separately reviewed release will still need an appropriately fresh pre-change backup.

## 1. Completed capture and future pre-change backup criteria

The October 20 capture is complete, with its non-atomic limitation recorded above. The criteria below apply to a future coordinated pre-change capture; they do not invalidate that completed result.

- Agree a capture window with a trusted operator and a documented way to prevent application, Auth and Storage writes during capture. If that consistency cannot be established, label the result non-atomic and leave full recovery unverified.
- Preserve the existing tested backups. Create a new uniquely identified backup set with application schema/data and migration histories, required database roles/grants, Auth recovery data/configuration, Storage bucket/object metadata, Storage policies and the actual file bytes. Verify coverage against the current supported Supabase backup/restore procedure before capture.
- Record component capture times, set ID, encrypted filenames/digests, schema and migration versions, and expected row/object counts in a manifest. Ensure every Storage metadata object has its corresponding bytes and account reference.
- Encrypt and verify all components and keep plaintext, credentials and account-level details outside the repository, PRs, logs and artifacts.

The current workflow intentionally pins October 16 filenames and counts. It must be reviewed and adapted to the new manifest before a fresh set can be tested; replacing files under old names would invalidate the evidence trail.

Preparation tooling: [fresh encrypted backup-set preflight](HUSTLE_FRESH_BACKUP_PREFLIGHT.md) provides a separate four-component manifest sealer and manual Drive integrity check. The October 20 native set uses a different inventory/archive contract and its own verified local restore. Do not rename or feed it into the legacy manifest or restore workflow. Capture consistency and real Auth/access acceptance remain unverified.

## 2. Complete the isolated recovery rehearsal

- Preserve the successful native restore and original metadata/file evidence above. Further rehearsals must use a new unlinked, disposable target and prove its identity and expected empty state before writes.
- The completed native import preserves the source database schema, roles and original Storage rows; compare relevant schema/security definitions and validate their actual API behavior in the isolated copy. Native import and row-count/hash checks alone are not end-to-end access proof.
- The prepared access helper includes a generated real-API recovery contract before private prompts. The generated contract now has a separate noninteractive GitHub entry point; record its actual cloud result independently from private acceptance. Offline tests alone do not prove either Docker execution or the private rehearsal.
- Use consenting designated test accounts to validate real sign-in and session refresh in the isolated copy. Keep their credentials private. If MFA is in scope, verify it separately; do not infer it from restored user rows.
- Check Client and Hustler account/capability behavior. Prove a file's rightful owner can access it, a different user cannot access private proofs/attachments, and public media follows the intended policy.
- Record actual results and remaining exclusions, then destroy the temporary copy and plaintext recovery material. Full recovery stays unverified until all agreed completion criteria pass.

## 3. Reconcile migration history before activation

Use the fresh restored copy and repository SQL for the initial comparison. The October 15 audit in [the activation record](FLOWTIME_EXISTING_SUPABASE_ACTIVATION.md) is historical context, not a current production audit.

An approved read-only metadata check on 2026-10-21 reconfirmed the separate ledgers and missing core runtime objects. Against repository revision `d9c6b02a8508ed93c00c7ef4dcce96378832615b`, 14 of 41 Prisma migration directories lack a successful stamp. The current rollout inventory also includes `20261016120000_marketplace_casework_api_access`; the earlier four-migration list omitted this follow-up. See the activation record for the refreshed inventory and its limits.

- For every physically present but unstamped Prisma migration, compare exact tables, columns/types/defaults, indexes, constraints, functions, triggers, grants, policies and required Storage configuration. Record a per-migration equivalence result and any repair SQL.
- Preserve the separate Prisma and Supabase migration histories. They need not have matching version numbers.
- Prepare the exact ledger-resolution plan only for migrations proven equivalent. Identify genuinely missing migrations and dependency order separately.
- Revalidate approved read-only production metadata immediately before a proposed rollout; compare it with the restored snapshot and stop on drift.
- Test proposed repairs and remaining migrations against a fresh disposable restore. Validate the `hustle_api` role and browser-role isolation, then booking capacity, last-slot concurrency and schedule-revision behavior.

## 4. Review and execute the release separately

Present the exact SQL/ledger operations, target revision, maintenance window, fresh pre-change backup, checks and compatible rollback plan for owner review. Production database changes and API/Web deployments remain separate deliberate actions after the gates above pass. Real payments/provider activation remain outside this work.

The owner authorized the read-only fresh capture and entered its private credentials locally. That authorization does not approve live database writes, migration-ledger changes, deployment or provider activation. This update records completed evidence and the remaining work; it starts no new recovery run and clears no production gate.

## Procedure references

- [Supabase database backup coverage](https://supabase.com/docs/guides/platform/backups), including the separate requirement for Storage file bytes.
- [Supabase CLI backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Recheck the supported procedure when implementing the new rehearsal.
