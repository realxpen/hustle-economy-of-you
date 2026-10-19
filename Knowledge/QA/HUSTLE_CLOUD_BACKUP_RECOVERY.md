# Hustle — Isolated Cloud Backup Recovery

Status: **APPLICATION AND AUTH RESTORED IN ISOLATED RUN / LOCAL BUCKET CREATION FIX PROPOSED**. PR #135 was merged as `f1dd2c605304644ded27f7e36bd46f5e8d8f1815`. Subsequent owner-triggered run [39237850966](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39237850966) used that commit, passed backup downloads/checksums, ephemeral local Supabase startup, application restore and Auth restore, then reported `LOCAL_BUCKET_MISSING` on the first Storage upload. Inspection identified a missing Docker stdin flag in the bucket-creation helper. The fix is covered by offline regression tests and the shared synthetic Storage contract; actual recovery with this fix remains untested. Metadata verification and full byte readback remain unverified. No production database access/change or application deployment was performed.

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

The first owner-triggered integration run passed the offline tests and dependency installation, then failed in the backup inventory/download/integrity preflight. Its log deliberately suppresses private exception details; it does not establish that the service-account credentials, folder permissions or encryption passwords are correct. Supabase installation/startup and all data restore steps were skipped, and the cleanup step succeeded.

Offline reproduction identified a definite request-construction bug: `files().list()` used `page_size` and `page_token`, while the Google discovery client requires `pageSize` and `pageToken`. The fix uses those documented names and isolates folder listing for credential-free tests. A strict Drive API fake verifies pagination through an empty intermediate page and duplicate-name rejection across pages. The new tests fail with the original keywords and pass after the correction. See Google's [Python quickstart](https://developers.google.com/workspace/drive/api/quickstart/python) and [files.list reference](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list).

PR #132 was subsequently merged. The October 19 owner-triggered run proves that its Drive access, four archive checksums, application decryption/transaction counts, Auth decryption (4 users, 4 identities) and Storage archive decryption/manifest checks succeeded. The Storage API upload into `agent-proofs` failed; its private CLI diagnostic was deleted by the successful always-run cleanup. The failure's detailed cause cannot be recovered from that run. The metadata passphrase has not yet been exercised by the final verification step.

A shared `storage-copy.sh` wrapper now captures both CLI output streams privately and emits only a fixed category via `report_storage_error.py`. It never prints raw Storage API responses, file paths or credentials from real recovery. Categories distinguish MIME/file-size rejection, local authentication/access/bucket/connection/file errors, unsupported CLI flags, existing objects and unclassified failures. A subprocess unit test verifies that both output streams stay private, the log has restrictive permissions and the wrapper preserves failure status. There is no automatic retry or relaxed bucket restriction.

A separate PR-only Local Storage CLI Contract uses generated PDF/PNG fixtures in its own fresh unlinked Supabase stack. That test has no recovery environment, Drive access, archive downloads or secrets. [Synthetic run 39235990134](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39235990134) passed uploads and byte-for-byte readbacks using CLI 2.121.0 on Ubuntu 24.04. Recovery pins that same CLI/runner and reports the installed version. That earlier synthetic test used its own bucket-creation command and did not exercise the faulty recovery helper.

After PR #135 merged, owner-triggered runs [39237064401](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39237064401) and [39237850966](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39237850966) both used the merged commit. The latest run exposed `LOCAL_BUCKET_MISSING`; its bucket-creation stage printed neither `INSERT` nor `DO`. The recovery helper invoked `docker exec` without `-i`, so the heredoc never reached `psql -f /dev/stdin`. An empty SQL input can exit successfully, skipping both bucket insertion and the assertion inside that same SQL block. See [Docker's stdin option](https://docs.docker.com/reference/cli/docker/container/exec/#options).

The proposed fix shares `storage-buckets.sh` between recovery and the synthetic contract. It forwards stdin with `docker exec -i`, limits the helper to the two named disposable containers, preserves all four buckets' audited settings, and separately checks that precisely the four expected bucket IDs/names exist with zero objects before any upload. Five subprocess regression tests cover actual SQL stdin delivery through a Docker fake, a successful no-op import, wrong bucket names/nonempty Storage, import failure, and unexpected containers. The positive test failed without `-i`; all 14 offline recovery tests pass with the fix. The synthetic PDF/PNG contract now runs the exact same four-bucket creation helper before uploading and byte-comparing generated files.

A new owner-controlled recovery run after review and merge is still required to validate all 10 real uploads/readbacks and the metadata passphrase/count check. No actual recovery retry is part of this fix. The earlier metadata, original IDs/ownership/RLS and real Auth session/sign-in limitations remain unchanged.
