# Hustle — Private native backup access check in GitHub

Date: 2026-10-21. Status: **AUTOMATED PROCEDURE PREPARED; ACTUAL PRIVATE RUN REQUIRES SECURE SECRET SETUP**.

## Purpose and finish line

The October 20 encrypted backup and successful local native restore remain completed work. This workflow completes the next narrow acceptance check without a laptop: restore that exact saved copy, sign in and refresh one original proof-owner account, verify all ten original files through Storage, and prove unrelated/anonymous/public requests cannot read that owner's private proofs. The result is one aggregate report after cleanup. It does not repeat production capture, modify production or activate a release.

## One-time browser setup

In the Hustle repository open **Settings → Environments → hustle-cloud-recovery**. Retain the existing dedicated Drive reader secret. Under **Environment secrets**, add these three values directly in GitHub:

| Secret name | Value |
| --- | --- |
| `HUSTLE_NATIVE_BACKUP_PASSPHRASE` | Existing encryption passphrase used for the successful October 20 backup |
| `HUSTLE_RECOVERY_OWNER_EMAIL` | Email of a consenting Hustle email/password account that uploaded a backed-up private Agent/Hustler proof |
| `HUSTLE_RECOVERY_OWNER_PASSWORD` | That account's password at the time of the October 20 capture |

These are environment secrets, not workflow form fields. Keep the environment restricted to `main` and retain its existing review protection. No new database password, Storage service key, Google account, paid project or fresh backup is needed. Do not send secret values to chat, commit them, or reset the original account merely to pass this test.

Open **Actions → Hustle Private Native Backup Access Check → Run workflow**. Choose `main` and enter the non-secret confirmation `VERIFY_NATIVE_BACKUP`. The agent owns inspecting the jobs, diagnosing failures, and recording actual results. If the GitHub connector cannot start this action, the only execution handoff is this browser button; there are no operator terminal commands.

## Scope and safeguards

- Only `workflow_dispatch`, `main`, the exact workflow revision, successful generated gate and `hustle-cloud-recovery` environment can reach the private job. PRs run generated tests without recovery secrets or Drive access.
- Actions and official Supabase images are pinned by commit/digest. Google authentication and dependencies are version/hash locked; installation occurs before secret exposure.
- The dedicated service account uses Drive's read-only scope. Source folder is fixed to the independently checked private October 20 set. It must contain exactly the eleven original backup files and the verified 1193-byte restore report. The inventory and prior report SHA-256 anchors are fixed; original encrypted file sizes/digests and checksum sidecars must pass before decryption. Only encrypted copies and the aggregate prior report are staged on the runner.
- Private credentials are consumed from step-scoped environment variables and immediately removed before any subprocess. The Google key signs through the official library in memory; only fixed HTTPS OAuth/Drive endpoints are allowed, redirects are rejected and TLS verification remains enabled. No source sharing or files are modified. A read-only principal may not see the full source ACL; owner-connected metadata independently confirmed restricted sharing on October 21, and any visible public/domain grant is rejected. Do not grant the reader writer privileges to inspect ACLs.
- Native imports retain roles/ownership/ACLs and strict failure handling. Plaintext database/files live in owned network-disabled Docker containers with no host mounts/ports and temporary RAM-backed storage. Restored Auth skips migrations; Storage is frozen at the reviewed source-compatible migration with checksum refresh disabled. Original metadata and migration/policy definitions must remain unchanged, apart from ignored access bookkeeping.
- The consenting original account is used without changing its password. A separate unrelated account is generated only in the copy. Both logins and session refreshes are verified with fresh local keys. Admin file readbacks do not substitute for normal-user permission assertions.
- All owned containers and encrypted staging copies must be removed before a passing report is written. Hard-canceled GitHub-hosted runners are discarded; cancellation or cleanup failure cannot produce a passing report. There is no broad Docker prune or deletion of unrelated resources.
- Only a strict aggregate JSON result is kept for seven days as `hustle-native-access-result`; no raw errors, SQL, account emails/IDs, tokens, private filenames, keys, decrypted data or archives are uploaded as artifacts. Reports explicitly leave full disaster recovery false.

## Evidence and next gate

Local offline validation passed **67/67 tests**, including the real Google signer with a generated key, read-only scope/fixed endpoint checks, secret consumption without child inheritance, file/report anchors, restricted download destinations, main/revision guards, exact size checks and failure/cleanup reporting. Actual cloud adapter results are recorded in the change's GitHub checks. The public workflow restores a generated native archive with ten generated files through the same private-copy adapter, including actual password login/refresh, eight private proofs and two public files. This validates the engineering path; it does not exercise the real uploaded backup or its credentials. The actual private run remains **NOT RUN** until the three secrets are configured and the deliberate main workflow is started.

After a real pass, record the run, exact revision and aggregate report fingerprint. Close this login/private-proof acceptance check and move to migration-equivalence/rehearsal work. MFA/OAuth, existing sessions, all accounts, message participants, application capability flows, external configuration and atomic capture remain excluded. Production database/ledger changes and deployments still require their separate exact release review.

References: [GitHub environment secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [Google service-account authentication](https://google-auth.readthedocs.io/en/latest/reference/google.oauth2.service_account.html), [Drive files metadata/permissions](https://developers.google.com/workspace/drive/api/reference/rest/v3/files).
