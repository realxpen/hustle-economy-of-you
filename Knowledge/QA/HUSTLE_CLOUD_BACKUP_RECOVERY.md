# Hustle — Isolated Cloud Backup Recovery

Status: **INSTALLATION PR / NOT MERGED / RECOVERY NOT EXECUTED**. Current authorization covers installing this package, offline validation and opening a pull request for review. Do not dispatch the cloud recovery job, access production database credentials, modify the production database or deploy the application as part of this change. Any future recovery rehearsal requires a separate owner instruction after review and setup.

## What this does

A **manual** GitHub Actions run uses a new ephemeral GitHub runner. It downloads only the **four verified October 16 encrypted backup archives and four `.sha256` checksums (Storage metadata is from 09:45, earlier than the other three exports)** from the existing private Google Drive backup folder. It checks those archives, starts a completely new local Supabase stack **inside the runner**, and restores the application, Auth accounts and local Storage bytes. It verifies the original Storage metadata archive's record counts, but it does not import the original IDs/owners into Storage. Secrets and decrypted content are never intentionally published to artifacts or logs. The runner is destroyed after the job.

This does **not** create a paid Supabase project or connect to the production Supabase database. It does **not** alter Prisma's production migration ledger, perform transactions, or deploy Vercel.

## Required archive inventory

These are exact names, no substitutions:

| Encrypted archive | Matching checksum |
| --- | --- |
| `hustle-appdb-20261016T115915Z.tar.gz.enc` | Same name + `.sha256` |
| `hustle-auth-20261016T120049Z.sql.gz.enc` | Same name + `.sha256` |
| `hustle-storage-metadata-20261016T094534Z.sql.gz.enc` | Same name + `.sha256` |
| `hustle-storage-20261016T121815Z.tar.gz.enc` | Same name + `.sha256` |

**Explicit non-atomic reference:** The 12:05 Storage metadata archive and checksum were not in Drive on the last authenticated check, but the **09:45 archive and checksum were present**. This cloud smoke test explicitly uses the older verified 09:45 snapshot instead. This is NOT equivalent to a consistent 12:05 Storage metadata restore, and the result must not be interpreted as one. A complete latest-state disaster-recovery test remains blocked until a fresh synchronized backup is made. The workflow requires all eight exact *listed* files.

## One-time GitHub/Google setup

1. Create a **dedicated Google Cloud service account** with the Google Drive API enabled. Grant it **reader access only** to the *single private Hustle backups folder* in the user's Google Drive. Do not enable link sharing or give it any Supabase/database privileges.
2. Generate a temporary service-account JSON credential. Keep it private and rotate/delete the key after the test. For longer-lived automation, Google Workload Identity Federation is preferable to a JSON key.
3. In GitHub repo → **Settings → Environments**, create `hustle-cloud-recovery`. Restrict it to `main` and ideally enable a required-reviewer gate. Create these **environment secrets**:
   - `HUSTLE_RESTORE_DRIVE_SA_JSON` — the dedicated Drive reader service-account JSON
   - `HUSTLE_RESTORE_APP_PASSPHRASE` — encryption password for the new app backup
   - `HUSTLE_RESTORE_AUTH_PASSPHRASE` — encryption password for the new Auth backup
   - `HUSTLE_RESTORE_STORAGE_PASSPHRASE` — encryption password for the new Storage backup
   - `HUSTLE_RESTORE_METADATA_PASSPHRASE` — encryption password for the new metadata backup
4. **Never** put the secrets into ChatGPT, a GitHub PR, README, workflow logs or another unencrypted artifact. A password that is reused across archives can be entered into more than one GitHub secret; do not assume reuse.
5. Merge the reviewed code only after the offline workflow checks pass. On GitHub Actions, select **Hustle Isolated Cloud Backup Recovery** → **Run workflow** on **main** and enter `EPHEMERAL_RESTORE` exactly. No restore runs on pull requests or pushes.

## Recovery assertions

Expected application counts: 6 users, 2 services, 8 bookings, 17 notifications. Expected Auth recovery: 4 users, 4 identities, no orphan identities. Expected Storage: 4 buckets, 10 files in the `agent-proofs`, `hustler-proofs`, and `message-attachments` buckets; `story-media` currently empty. All Storage bytes are read back through the *local* Supabase API and byte-compared. The *earlier 09:45* metadata reference must include 4 buckets and 10 objects; this is only a basic consistency/count check, not proof that its IDs or ownership match the 12:18 files.

A green run is only a **smoke test**. It does **not** prove original Storage object UUIDs, owner metadata, timestamps or Storage RLS policy recovery; real Auth sign-in, MFA and sessions remain untested. The snapshots were exported at different times and are not a single atomic transaction snapshot; the 09:45 metadata reference is especially earlier than the app, Auth and Storage-byte exports. A separate disaster-recovery completion gate is still required.

## Security conditions

- The full job is `workflow_dispatch`, exact confirmation, and `main` only. PRs run syntax and static guard tests without secrets.
- No production connection strings, Supabase access tokens or Vercel production tokens are needed. Restore scripts refuse recognized production-capable environment variables, and verify an exact **unlinked** local Supabase project and Docker container name.
- The Drive service-account principal gets a **read-only Drive API scope**; its folder share should be limited to the backup folder. Its key is provided only as an environment secret.
- Decrypted content lives in private directories on a transient runner; sensitive SQL import diagnostics and Storage API details are written to private files, not CI logs. GitHub-hosted ephemeral runners are still third-party infrastructure holding sensitive data temporarily, as approved by the owner.
- The always-run cleanup deletes temporary plaintext extraction folders, downloaded encrypted archives and private import logs. The runner and its Docker volumes are then discarded by GitHub.
- Do not use `prisma migrate deploy`, `prisma migrate resolve` or `supabase db reset` on the existing live project based on this test. Those require separate production approval and a fresh maintenance-window backup.

## Status and known limitations

Prepared scripts have been syntax checked and security helper unit-tested, but their **GitHub Actions integration has not been executed**. Any operational issues surfaced by the first controlled run must be investigated before treating the result as validated. The earlier successful on-laptop app/Auth restores remain separate evidence.
