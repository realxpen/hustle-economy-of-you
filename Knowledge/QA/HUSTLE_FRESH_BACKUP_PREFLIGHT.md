# Hustle — Fresh encrypted backup-set preflight

Status: **THIS TOOL IS MANIFEST PREFLIGHT ONLY**. A separate fresh native capture and local database/file restore passed on 2026-10-20; [the recovery plan](HUSTLE_FULL_RECOVERY_AND_ACTIVATION_PLAN.md) records that completed evidence and the remaining Auth/API checks. The native set uses a different inventory/archive contract; do not rename or feed it into this four-component manifest workflow. Its completion does not require rerunning this preparation milestone.

This is the next preparation milestone after the verified October 16 recovery smoke test. It checks a new encrypted set by its own manifest instead of reusing old filenames or fixed counts. It does not export production data, decrypt archives, restore a database, or prove full recovery. The successful legacy recovery workflow remains unchanged.

## Contract

A manifest identifies one backup set and the existing Hustle source project. It records an operator-declared write-freeze window/reference, per-component capture times, coverage declarations, expected counts, and four exact encrypted archive filenames, sizes and SHA-256 digests. Every capture time must fall within that window. Freeze and coverage declarations are not independently verified by this tool.

| Component | Required declared coverage |
| --- | --- |
| `application` | Application schema/data, roles/grants, Prisma and Supabase migration histories |
| `auth` | Users, identities, Auth configuration |
| `storage_metadata` | Buckets, objects, access policies |
| `storage_files` | File bytes and their internal hash manifest |

All four archives use one set-ID filename prefix; each has a matching `.sha256` sidecar. The manifest's SHA-256 is supplied separately when starting the check, so replacing a Drive manifest cannot silently change the selected set. Capture preparation still follows [the full recovery plan](HUSTLE_FULL_RECOVERY_AND_ACTIVATION_PLAN.md). Actual MFA/session and original-ownership recovery remain separate tests.

The preflight rejects unknown/duplicate JSON fields, missing components/coverage, unsafe filenames, the wrong declared project reference, out-of-window captures, invalid count fields, duplicate Drive names, converted Google files, size/digest mismatches, and symlinked local archive inputs. Limits: 64 KiB manifest, 512 bytes per checksum and 512 MiB per encrypted archive. Larger sets need a reviewed limit change.

## Trusted operator preparation

Do this only after separately authorized capture into a private folder outside the repository. No production credentials are needed by the tools below.

1. Preserve the old tested set. Use one new ID, for example `hustle-20261019T130000Z`, for a new set.
2. Encrypt the four newly captured components and name them as shown in `scripts/recovery/examples/backup-set.draft.json`, replacing the example ID consistently. Use a folder accessible only to its owner.
3. Copy that example to a private `draft.json`. Replace the capture window/reference, component capture times and counts with the operator's actual record. Only declare coverage that was actually captured. Do not add passwords, JSON credentials, account identifiers or file paths to the draft.
4. From the repository checkout, run:

```sh
python scripts/recovery/seal_backup_set.py \
  --draft /absolute/private-backup-folder/draft.json \
  --directory /absolute/private-backup-folder
```

The tool reads the four already encrypted archives, computes their sizes/hashes, creates matching checksum sidecars and writes `<set-id>.manifest.json` plus its checksum. It refuses to replace an existing manifest or conflicting checksum. It prints the manifest fingerprint locally; keep that fingerprint from this trusted step.

5. Upload the four encrypted archives, their four checksum files and the manifest into the existing private Hustle backup folder. The manifest checksum can also be kept there, but the workflow uses the fingerprint retained independently from step 4. Keep the dedicated reader's existing Viewer access and the folder restricted.

## Owner-controlled check after review and merge

Open **Hustle Encrypted Backup Set Preflight** in GitHub Actions. Select `main`, enter `VERIFY_ENCRYPTED_SET`, enter the exact manifest filename, and enter the independently retained manifest SHA-256. Starting this workflow is a deliberate separate action; it has not been started during implementation.

The manual job uses only the existing `HUSTLE_RESTORE_DRIVE_SA_JSON` environment secret and a read-only Drive scope. It downloads into a private runner directory, validates the manifest and all eight archive/checksum files, and always requests cleanup. No archive passphrases, production database credentials, Supabase stack or deployment tools are used. PRs execute only generated-fixture offline tests without secrets.

Expected success: **encrypted inventory, sizes and digests verified**. Source identity, capture consistency and coverage remain operator-declared. Record counts, encryption format/passwords, decryption, metadata restoration, login/access checks and full disaster recovery are unverified. The existing October 16 restore must not be pointed at these files; fresh-set restore integration is still a separate implementation milestone.
