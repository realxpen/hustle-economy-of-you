# Hustle — Next recovery and activation milestones

Prepared: 2026-10-19. Status: **PLAN ONLY; PRODUCTION ACTIVATION REMAINS BLOCKED**.

## Completed baseline

Owner-triggered [run 39241163040](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39241163040) passed on PR #139 merge `94e12fa6dc3ed5278e9747f6ba4e7b6f654ce019`. Application and Auth records restored; all 10 backed-up files were uploaded, downloaded and byte-compared; the older metadata reference decrypted and passed its count check. See [the verified recovery record](HUSTLE_CLOUD_BACKUP_RECOVERY.md).

This is the completed partial smoke test. The next milestone is proving that a restored copy preserves users' ability to sign in and access the correct files, using a coordinated fresh backup.

## 1. Prepare and capture a coordinated backup

- Agree a capture window with a trusted operator and a documented way to prevent application, Auth and Storage writes during capture. If that consistency cannot be established, label the result non-atomic and leave full recovery unverified.
- Preserve the existing tested backups. Create a new uniquely identified backup set with application schema/data and migration histories, required database roles/grants, Auth recovery data/configuration, Storage bucket/object metadata, Storage policies and the actual file bytes. Verify coverage against the current supported Supabase backup/restore procedure before capture.
- Record component capture times, set ID, encrypted filenames/digests, schema and migration versions, and expected row/object counts in a manifest. Ensure every Storage metadata object has its corresponding bytes and account reference.
- Encrypt and verify all components and keep plaintext, credentials and account-level details outside the repository, PRs, logs and artifacts.

The current workflow intentionally pins October 16 filenames and counts. It must be reviewed and adapted to the new manifest before a fresh set can be tested; replacing files under old names would invalidate the evidence trail.

## 2. Complete the isolated recovery rehearsal

- Restore into a new unlinked, disposable Supabase instance. Prove the target identity and expected empty state before writes.
- Rehearse a supported recovery method that preserves original Storage object IDs, owners, timestamps, bucket settings and access policies together with matching file bytes. First validate that method with generated fixtures; the current upload-only adapter does not preserve those metadata fields.
- Verify schema objects, roles/grants, foreign keys, migration histories, row/object counts, object paths and every file's byte digest against the new manifest. A row-count match alone is insufficient.
- Use consenting designated test accounts to validate real sign-in and session refresh in the isolated copy. Keep their credentials private. If MFA is in scope, verify it separately; do not infer it from restored user rows.
- Check Client and Hustler account/capability behavior. Prove a file's rightful owner can access it, a different user cannot access private proofs/attachments, and public media follows the intended policy.
- Record actual results and remaining exclusions, then destroy the temporary copy and plaintext recovery material. Full recovery stays unverified until all agreed completion criteria pass.

## 3. Reconcile migration history before activation

Use the fresh restored copy and repository SQL for the initial comparison. The October 15 audit in [the activation record](FLOWTIME_EXISTING_SUPABASE_ACTIVATION.md) is historical context, not a current production audit.

- For every physically present but unstamped Prisma migration, compare exact tables, columns/types/defaults, indexes, constraints, functions, triggers, grants, policies and required Storage configuration. Record a per-migration equivalence result and any repair SQL.
- Preserve the separate Prisma and Supabase migration histories. They need not have matching version numbers.
- Prepare the exact ledger-resolution plan only for migrations proven equivalent. Identify genuinely missing migrations and dependency order separately.
- Revalidate approved read-only production metadata immediately before a proposed rollout; compare it with the restored snapshot and stop on drift.
- Test proposed repairs and remaining migrations against a fresh disposable restore. Validate the `hustle_api` role and browser-role isolation, then booking capacity, last-slot concurrency and schedule-revision behavior.

## 4. Review and execute the release separately

Present the exact SQL/ledger operations, target revision, maintenance window, fresh pre-change backup, checks and compatible rollback plan for owner review. Production database changes and API/Web deployments remain separate deliberate actions after the gates above pass. Real payments/provider activation remain outside this work.

The existing instruction forbids production credential access, live database changes and deployment during recovery preparation. This document records the path forward; it performs none of those actions and does not start another recovery run.

## Procedure references

- [Supabase database backup coverage](https://supabase.com/docs/guides/platform/backups), including the separate requirement for Storage file bytes.
- [Supabase CLI backup and restore procedure](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). Recheck the supported procedure when implementing the new rehearsal.
