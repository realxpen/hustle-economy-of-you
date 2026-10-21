#!/usr/bin/env python3
"""Apply reviewed pending SQL only to a new native restore in offline Docker."""
import argparse
from datetime import datetime, timezone
import logging
import os
from pathlib import Path
import re
import signal
import sys
import tempfile

import pending_migrations as pending
import private_migration_audit as previous

audit, access, core, cloud = pending.audit, pending.access, pending.core, pending.cloud
WORKFLOW = 'realxpen/hustle-economy-of-you/.github/workflows/hustle-native-migration-rehearsal.yml@refs/heads/main'
CONFIRM = 'REHEARSE_SAVED_MIGRATIONS'


def guard():
    core.require(os.environ.get('GITHUB_WORKFLOW_REF') == WORKFLOW
        and os.environ.get('GITHUB_REF') == 'refs/heads/main'
        and os.environ.get('GITHUB_EVENT_NAME') == 'workflow_dispatch'
        and os.environ.get('GITHUB_JOB') == 'private-rehearsal'
        and not os.environ.get('GITHUB_HEAD_REF')
        and os.environ.get('HUSTLE_REHEARSAL_CONFIRM') == CONFIRM
        and os.environ.get('HUSTLE_GENERATED_GATE') == 'passed',
        'REHEARSAL_JOB_GUARD', 'Use the protected main-only saved migration rehearsal after its generated gate.')
    revision = os.environ.get('GITHUB_SHA','')
    core.require(re.fullmatch('[0-9a-f]{40}',revision)
        and core.run(['git','rev-parse','HEAD']).stdout.strip().decode() == revision,
        'REHEARSAL_REVISION','The checkout must match the selected main workflow revision.')
    root = Path(os.environ.get('RUNNER_TEMP',''))
    core.require(root.is_absolute() and str(root) not in ('/','/tmp') and root.is_dir()
        and not root.is_symlink() and root.stat().st_uid == os.getuid(),
        'REHEARSAL_TEMP','The owned runner temporary directory was invalid.')
    cloud.preflight()
    cloud.assert_clean()
    return root


def rehearse_copy(folder, passphrase):
    reference_db, restored_db = core.Database(), core.Database()
    try:
        reference_db.start()
        historical, scopes, _ = audit.reference_contract(reference_db)
        expected, affected = pending.pending_reference(reference_db,historical)
        reference_db.cleanup()
        reference = core.read_reference(folder,passphrase)
        restored_db.start()
        restored_db.restore(folder,passphrase)
        core.compare_database(restored_db.catalog(),reference)
        pending.prepare_database_owner(restored_db)
        before_schema = audit.snapshot(restored_db)
        core.require(all(r['schema_contract_matched'] for r in audit.compare(historical,before_schema,scopes)),
            'REHEARSAL_HISTORICAL','A historical schema contract did not match; no pending SQL was applied.')
        pending.verify_source_pending(restored_db)
        tables = pending.original_tables(restored_db)
        rows = pending.fingerprints(restored_db,tables)
        ledgers = access.private_sql(restored_db,previous.LEDGERS)
        print('Applying the five reviewed SQL files in one transaction inside the disposable restore.',flush=True)
        pending.apply_pending(restored_db)
        after_schema = audit.snapshot(restored_db)
        pending.compare_after(before_schema,after_schema,expected,affected)
        core.require(pending.fingerprints(restored_db,tables) == rows,
            'REHEARSAL_DATA_CHANGED','Original application/Auth/Storage/history row contents changed. No passing report.')
        core.require(access.private_sql(restored_db,previous.LEDGERS) == ledgers,
            'REHEARSAL_LEDGER_CHANGED','A migration history changed during the SQL-only rehearsal.')
        pending.verify_defaults(restored_db,True)
        core.compare_database(restored_db.catalog(),reference)
        print('Checking casework/FlowTime permissions and financial/receipt row isolation in the owned local test copy.',flush=True)
        pending.access_contracts(restored_db)
        core.require(pending.fingerprints(restored_db,tables) == rows,
            'REHEARSAL_DATA_CHANGED','The access tests changed original rows in the restored database.')
        return {'original_tables_hashed':len(tables),'pending_sql_files_applied':5,
                'historical_schema_contracts_matched':9,'affected_schema_objects_matched':len(affected)}
    finally:
        core.cleanup_all([reference_db,restored_db])


def safe_report(result):
    allowed = {'original_tables_hashed','pending_sql_files_applied','historical_schema_contracts_matched','affected_schema_objects_matched'}
    core.require(set(result) == allowed and all(type(v) is int and 0 < v < 1000 for v in result.values())
        and result['pending_sql_files_applied'] == 5 and result['historical_schema_contracts_matched'] == 9,
        'REHEARSAL_REPORT','The aggregate rehearsal result had unexpected fields or counts.')
    return dict(result,format='hustle-native-pending-sql-v1',backup_set_id=core.SET_ID,
        inventory_sha256=core.INVENTORY_SHA256,repository_sha=os.environ['GITHUB_SHA'],
        checked_at=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        pending_sql_sha256=pending.PENDING_HASHES,
        original_row_counts_and_sha256_preserved=True,migration_ledgers_unchanged=True,
        disposable_database_owner_matches_verified_source=True,
        original_storage_catalog_matches=True,existing_service_and_booking_new_defaults_passed=True,
        existing_refund_data_passed_new_unique_index=True,casework_and_flowtime_access_assertions_passed=True,
        generated_financial_and_receipt_rows_denied_to_browser_roles=True,
        generated_financial_and_receipt_rows_visible_to_api_role=True,
        temporary_containers_removed=True,downloaded_encrypted_copies_removed=True,
        production_accessed=False,production_changed=False,ledger_resolution_authorized=False,
        prisma_deploy_rehearsed=False,application_booking_concurrency_tested=False,
        post_migration_auth_storage_apis_tested=False,full_disaster_recovery_verified=False)


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    os.umask(0o077)
    logging.disable(logging.CRITICAL)
    signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        service_account,passphrase = previous.take_inputs()
        root = guard()
        with tempfile.TemporaryDirectory(prefix='hustle-native-pending-sql-',dir=root) as temporary:
            drive = audit.private.Drive(service_account)
            service_account = ''
            folder = audit.private.download_set(drive,Path(temporary))
            drive.credentials.token = None
            del drive
            result = rehearse_copy(folder,passphrase)
        passphrase = ''
        cloud.assert_clean()
        core.require(not Path(temporary).exists(),'REHEARSAL_CLEANUP','Encrypted staging copies were not removed.')
        core.private_write(root / 'hustle-native-pending-sql.json',core.canonical(safe_report(result))+b'\n')
        print('SAVED NATIVE PENDING SQL REHEARSAL PASSED: five SQL files, original rows, schema, defaults, permissions and cleanup.')
        print('Prisma history resolution/deploy and application concurrency were not tested; no production changes.')
        return 0
    except core.RestoreError as error:
        print('['+error.code+'] '+error.message,file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print('[REHEARSAL_INTERRUPTED] No complete rehearsal report.',file=sys.stderr)
        return 1
    except Exception as error:
        print('[REHEARSAL_FAILED] '+type(error).__name__+'; no private diagnostic or passing report.',file=sys.stderr)
        return 1
    finally:
        for name in previous.SECRETS:
            os.environ.pop(name,None)


if __name__ == '__main__':
    raise SystemExit(main())
