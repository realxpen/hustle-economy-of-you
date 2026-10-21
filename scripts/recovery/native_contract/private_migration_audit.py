#!/usr/bin/env python3
"""Compare the exact saved native schema; never stamp or alter the restored schema.

Only the reference container executes repository migrations. The actual backup
container receives its strict native import, then read-only catalog queries.
No owner account/password or production database credential is needed.
"""
import argparse
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
import signal
import sys
import tempfile

import migration_audit as audit

private, access, core, cloud = audit.private, audit.access, audit.core, audit.cloud
WORKFLOW = 'realxpen/hustle-economy-of-you/.github/workflows/hustle-native-migration-audit.yml@refs/heads/main'
CONFIRM = 'AUDIT_SAVED_MIGRATIONS'
SECRETS = ('HUSTLE_RESTORE_DRIVE_SA_JSON', 'HUSTLE_NATIVE_BACKUP_PASSPHRASE')


def take_inputs():
    values = tuple(os.environ.pop(k, '') for k in SECRETS)
    core.require(all(values), 'AUDIT_SECRET_SETUP', 'The existing Drive reader and native backup passphrase secrets are required.')
    password = values[1]
    core.require(16 <= len(password.encode()) <= 1024 and not any(c in password for c in '\r\n\0'),
                 'AUDIT_PASSPHRASE', 'Use the existing native backup encryption passphrase.')
    return values


def guard():
    core.require(os.environ.get('GITHUB_WORKFLOW_REF') == WORKFLOW
        and os.environ.get('GITHUB_REF') == 'refs/heads/main'
        and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
        and os.environ.get('GITHUB_JOB') == 'private-audit'
        and not os.environ.get('GITHUB_HEAD_REF')
        and os.environ.get('HUSTLE_AUDIT_CONFIRM') == CONFIRM
        and os.environ.get('HUSTLE_GENERATED_GATE') == 'passed',
        'AUDIT_JOB_GUARD', 'Use the protected main-only migration audit after the generated gate.')
    revision = os.environ.get('GITHUB_SHA', '')
    core.require(re.fullmatch('[0-9a-f]{40}', revision)
        and core.run(['git', 'rev-parse', 'HEAD']).stdout.strip().decode() == revision,
        'AUDIT_REVISION', 'The checkout must match the selected main workflow revision.')
    root = Path(os.environ.get('RUNNER_TEMP', ''))
    core.require(root.is_absolute() and str(root) not in ('/', '/tmp') and root.is_dir()
        and not root.is_symlink() and root.stat().st_uid == os.getuid(),
        'AUDIT_TEMP', 'The owned runner temporary directory was invalid.')
    cloud.preflight()
    cloud.assert_clean()
    return root


LEDGERS = """BEGIN READ ONLY;
SELECT jsonb_build_object('prisma', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.id) FROM public._prisma_migrations m),
 'supabase', (SELECT jsonb_agg(to_jsonb(m) ORDER BY m.version) FROM supabase_migrations.schema_migrations m));
COMMIT;"""


def audit_copy(folder, passphrase):
    reference_db, restored_db = core.Database(), core.Database()
    try:
        print('Building a schema-only reference from the exact committed SQL.', flush=True)
        reference_db.start()
        expected, scopes, hashes = audit.reference_contract(reference_db)
        reference_db.cleanup()
        print('Importing the native backup into a new offline target for read-only comparison.', flush=True)
        reference = core.read_reference(folder, passphrase)
        restored_db.start()
        restored_db.restore(folder, passphrase)
        core.compare_database(restored_db.catalog(), reference)
        ledgers = access.private_sql(restored_db, LEDGERS)
        actual = audit.snapshot(restored_db)
        results = audit.compare(expected, actual, scopes)
        core.require(access.private_sql(restored_db, LEDGERS) == ledgers,
            'AUDIT_LEDGER_CHANGED', 'The read-only comparison changed a migration ledger.')
        core.compare_database(restored_db.catalog(), reference)
        return {'migration_results': results, 'repository_migration_sha256': hashes,
                'historical_schema_contracts_all_matched': all(x['schema_contract_matched'] for x in results)}
    finally:
        core.cleanup_all([reference_db, restored_db])


def safe_report(result):
    return dict(result, format='hustle-native-migration-audit-v1', backup_set_id=core.SET_ID,
        inventory_sha256=core.INVENTORY_SHA256, repository_sha=os.environ['GITHUB_SHA'],
        checked_at=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        production_accessed=False, production_changed=False,
        restored_schema_changed_after_import=False, migration_ledgers_unchanged=True,
        ledger_resolution_authorized=False, full_migration_equivalence_certified=False,
        actual_pending_migrations_rehearsed=False, temporary_containers_removed=True,
        downloaded_encrypted_copies_removed=True)


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    os.umask(0o077)
    logging.disable(logging.CRITICAL)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        service_account, passphrase = take_inputs()
        root = guard()
        with tempfile.TemporaryDirectory(prefix='hustle-native-migration-audit-', dir=root) as temporary:
            drive = private.Drive(service_account)
            service_account = ''
            folder = private.download_set(drive, Path(temporary))
            drive.credentials.token = None
            del drive
            result = audit_copy(folder, passphrase)
        passphrase = ''
        cloud.assert_clean()
        core.require(not Path(temporary).exists(), 'AUDIT_CLEANUP', 'Encrypted staging copies were not removed.')
        core.private_write(root / 'hustle-native-migration-audit.json', core.canonical(safe_report(result)) + b'\n')
        print('SAVED NATIVE MIGRATION AUDIT COMPLETE; consult the per-migration comparison result.')
        print('No ledger stamps, pending migrations, production access or deployments were performed.')
        # Mismatch is a completed diagnostic, NOT an equivalence approval. The
        # report explicitly records blocked authority even if all checks match.
        return 0
    except core.RestoreError as error:
        print('[' + error.code + '] ' + error.message, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('[AUDIT_INTERRUPTED] No complete audit report.', file=sys.stderr)
        return 1
    except Exception as error:
        print('[AUDIT_FAILED] ' + type(error).__name__ + '; no private diagnostic or complete report.', file=sys.stderr)
        return 1
    finally:
        for name in SECRETS:
            os.environ.pop(name, None)


if __name__ == '__main__':
    raise SystemExit(main())
