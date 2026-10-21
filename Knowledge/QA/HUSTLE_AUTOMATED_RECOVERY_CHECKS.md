# Hustle — Agent-run recovery engineering checks

Date: 2026-10-21. Status: **IMPLEMENTED; REAL CLOUD EXECUTION PENDING**.

## Owner workflow

The owner asked to guide the product, provide access the agent cannot obtain, and test the actual experience. Routine script execution and engineering debugging belong to the agent. The current laptop-only handoff is replaced by GitHub-run checks wherever private backup access is unnecessary.

`.github/workflows/hustle-generated-recovery.yml` runs automatically on relevant pull requests and changes to `main`. It has a manual rerun entry point without inputs. No terminal work, production connection, recovery environment, stored secret, backup download or private account is required. The existing isolated Prisma ledger rehearsal also runs on changes to this contract, exercising the simulated 27→36→41 migration sequence.

## What runs

1. Existing native recovery and Auth/Storage unit regressions plus generated-only runner tests. They exercise real OpenSSL and Node HTTP/file pipelines, strict import/identity checks, token validation, owner selection, private input separation and cleanup failures.
2. Native PostgreSQL 17 generated recovery: source bootstrap role, grants and native archive, original generated Storage metadata, recovered file bytes and owner/other-user RLS.
3. Generated real API recovery: create temporary users/files, export roles/native database, remove the source, restore a new offline target, stage matching bytes using the official pinned Storage file backend, and prove password sign-in, session refresh, rightful owner access, unrelated/anonymous/public-route denial and public-file readback. Starting restored services must preserve migration/policy definitions.
4. Verify temporary containers were removed before reporting success. Both contracts retain their exact resource ownership and isolation guards. On hard runner cancellation the generated-only GitHub-hosted runner is discarded; there is no broad Docker prune or deletion of unrelated resources.

The two imported helpers begin as exact copies of the previously delivered tools. `hustle-restore-test-v2.py` retains SHA-256 `ff7d194585a90017e25515da73e02be0cc3ebff2817cafbf5fce6001cdd4e192`; the API helper checks it before import. The noninteractive CI entry point calls only generated contracts and performs its own runner/socket/credential-environment preflight. It does not bypass the interactive private entry points' terminal guard or invoke them.

Images are official and pinned by digest: Supabase PostgreSQL 17.6.1.166, Auth v2.197.0, Storage API v1.80.0. Restored Auth uses `serve` without automatic migrations; Storage is frozen at the reviewed migration with checksum refresh disabled. Database/API containers publish no host ports, mount no host directories, and share a network-disabled namespace with loopback-only service connections. Credentials are generated for the fixture and destroyed with it. These version-specific native/backend checks are a narrow rehearsal, not a claim of general platform-to-self-hosted compatibility.

## Actual backup gate and remaining access

The October 20 real native database/file restore remains a completed, independently recorded result; [the recovery plan](HUSTLE_FULL_RECOVERY_AND_ACTIVATION_PLAN.md) holds its fingerprints. The new automatic tests use generated data. They cannot decrypt that private set or verify its actual account password: the new backup passphrase and proof-owner credentials are not connected to this runner. The four legacy GitHub passphrase secrets must not be assumed to match the new set.

An unattended private rehearsal would require a separately reviewed, explicitly selected backup/report and approved secure runtime credential delivery. Do not prompt for secrets in chat, silently copy laptop credentials, attach secrets to PRs, or mark the private acceptance passed from generated tests. Keep this specific access gate pending while continuing code review and automated engineering work. If owner action is needed, prepare the exact secure configuration first and request only that action through an appropriate account/settings UI.

MFA/OAuth, existing-session recovery, all accounts, message participants, application capability flows, external configuration, coordinated capture and full disaster recovery remain outside this contract. No production writes, migration resolution, deployment or payment activation is authorized by a passing run.

## Validation record

- Local offline regression results: **55/55 passed**, including real OpenSSL and Node pipelines plus five noninteractive CI boundary/orchestration checks. Python ResourceWarnings are treated as errors.
- Actual GitHub PostgreSQL/Auth/Storage contract: pending; do not infer success from source or unit checks.

References: [Supabase platform-to-self-hosted restore guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform) and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control). Current version changes were reviewed against [the changelog](https://supabase.com/changelog.md).
