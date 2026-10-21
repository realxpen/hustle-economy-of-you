import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import MagicMock, patch

import pending_migrations as pending
import private_pending_migrations as private


class PendingTests(unittest.TestCase):
    def test_only_the_five_reviewed_sql_digests_can_execute(self):
        sql = pending.pending_sql()
        self.assertEqual(set(pending.PENDING_HASHES),set(pending.audit.PENDING))
        self.assertTrue(all(len(v)==64 for v in pending.PENDING_HASHES.values()))
        self.assertTrue(sql.startswith('BEGIN;'))
        self.assertTrue(sql.endswith('COMMIT;'))
        self.assertNotIn('migrate resolve',sql)
        self.assertNotIn('DELETE FROM',sql)
        with patch.object(Path,'read_bytes',return_value=b'changed SQL'), self.assertRaises(pending.core.RestoreError):
            pending.pending_sql()

    def test_pending_payload_is_one_strict_sql_call_to_the_owned_target(self):
        database = object()
        with patch.object(pending.access,'private_sql') as execute:
            pending.apply_pending(database)
        execute.assert_called_once_with(database,pending.pending_sql())

    def test_hash_query_projects_original_columns_and_returns_only_digest_and_count(self):
        table = {'schema':'public','table':'Service','columns':['id','title']}
        sql = pending.fingerprint_sql(table)
        self.assertIn('BEGIN READ ONLY',sql)
        self.assertIn('SELECT "id","title" FROM "public"."Service"',sql)
        self.assertIn('row_to_json(t)',sql)
        self.assertIn('sha256(',sql)
        self.assertIn("ORDER BY h",sql)
        self.assertNotIn('SELECT *',sql)
        self.assertNotIn('bookingTimezone',sql)
        self.assertIn("'count',count(*)",sql)

    def test_identifier_escaping_and_schema_allowlist(self):
        self.assertEqual(pending.ident('a"b'),'"a""b"')
        for value in ('','nul\0name','x'*64):
            with self.assertRaises(pending.core.RestoreError): pending.ident(value)
        with self.assertRaises(pending.core.RestoreError):
            pending.fingerprint_sql({'schema':'pg_catalog','table':'pg_authid','columns':['rolpassword']})

    def test_missing_expected_schema_and_unrelated_changes_stop_the_rehearsal(self):
        before={'relation:Existing':{'rls':True}}
        expected={**before,'relation:New':{'rls':True}}
        pending.compare_after(before,expected,expected,['relation:New'])
        for actual in (before,{**expected,'relation:Existing':{'rls':False}},{**expected,'relation:Unexpected':{}}):
            with self.assertRaises(pending.core.RestoreError):
                pending.compare_after(before,actual,expected,['relation:New'])

    def test_existing_pending_objects_or_duplicate_refunds_are_not_ignored(self):
        valid={'tables_absent':True,'refund_index_absent':True,'duplicate_active_refunds':0}
        with patch.object(pending.access,'private_sql',return_value=json.dumps(valid).encode()):
            pending.verify_source_pending(object())
        for key,value in [('tables_absent',False),('refund_index_absent',False),('duplicate_active_refunds',1)]:
            with patch.object(pending.access,'private_sql',return_value=json.dumps({**valid,key:value}).encode()), \
                 self.assertRaises(pending.core.RestoreError): pending.verify_source_pending(object())

    def test_actual_defaults_checks_require_existing_services_and_bookings(self):
        result={'services':2,'bookings':8,'service_defaults':True,'booking_defaults':True,'new_tables_empty':True}
        with patch.object(pending.access,'private_sql',return_value=json.dumps(result).encode()):
            pending.verify_defaults(object(),True)
        for key,value in [('services',0),('bookings',0),('service_defaults',False),('booking_defaults',False),('new_tables_empty',False)]:
            with patch.object(pending.access,'private_sql',return_value=json.dumps({**result,key:value}).encode()), \
                 self.assertRaises(pending.core.RestoreError): pending.verify_defaults(object(),True)

    def test_access_assertions_retain_fixed_sandbox_guard_and_reject_visible_browser_rows(self):
        with patch.object(pending.access,'private_sql'), patch.object(pending,'sandbox_sql',side_effect=[b'',b'',b'[0,0]\n[0,0]\n[1,1]']) as execute:
            pending.access_contracts(object())
            self.assertIn("current_database() <> 'hustle_payment_sandbox'",execute.call_args_list[0].args[1])
            self.assertIn('ROLLBACK;',execute.call_args.args[1])
        with patch.object(pending.access,'private_sql'), patch.object(pending,'sandbox_sql',side_effect=[b'',b'',b'[1,1]\n[0,0]\n[1,1]']), \
             self.assertRaises(pending.core.RestoreError): pending.access_contracts(object())

    def test_guard_requires_main_manual_workflow_job_confirmation_gate_and_revision(self):
        with tempfile.TemporaryDirectory() as root:
            env={'GITHUB_WORKFLOW_REF':private.WORKFLOW,'GITHUB_REF':'refs/heads/main',
                 'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_JOB':'private-rehearsal',
                 'HUSTLE_REHEARSAL_CONFIRM':private.CONFIRM,'HUSTLE_GENERATED_GATE':'passed',
                 'GITHUB_SHA':'a'*40,'RUNNER_TEMP':root}
            with patch.dict(os.environ,env,clear=True), patch.object(private.core,'run',return_value=SimpleNamespace(stdout=b'a'*40)), \
                 patch.object(private.cloud,'preflight'),patch.object(private.cloud,'assert_clean'):
                self.assertEqual(private.guard(),Path(root))
                for key,value in [('GITHUB_REF','refs/heads/feature'),('GITHUB_JOB','private-audit'),
                    ('GITHUB_EVENT_NAME','pull_request_target'),('GITHUB_WORKFLOW_REF','other'),
                    ('HUSTLE_REHEARSAL_CONFIRM',''),('HUSTLE_GENERATED_GATE',''),('GITHUB_SHA','b'*40),('GITHUB_HEAD_REF','feature')]:
                    with self.subTest(key=key),patch.dict(os.environ,{key:value}),self.assertRaises(pending.core.RestoreError):
                        private.guard()

    def test_historical_mismatch_stops_before_pending_writes_and_cleans_both_targets(self):
        first,second=MagicMock(),MagicMock()
        with patch.object(private.core,'Database',side_effect=[first,second]), \
             patch.object(private.audit,'reference_contract',return_value=({}, {}, {})), \
             patch.object(private.pending,'pending_reference',return_value=({}, [])), \
             patch.object(private.core,'read_reference',return_value={}),patch.object(private.core,'compare_database'), \
             patch.object(private.audit,'snapshot',return_value={}), \
             patch.object(private.audit,'compare',return_value=[{'schema_contract_matched':False}]), \
             patch.object(private.pending,'apply_pending') as apply,patch.object(private.core,'cleanup_all') as cleanup, \
             self.assertRaises(pending.core.RestoreError):
            private.rehearse_copy(Path('/generated'), 'generated-password')
        apply.assert_not_called()
        cleanup.assert_called_once_with([first,second])

    def test_aggregate_report_rejects_private_fields_and_preserves_exclusions(self):
        good={'original_tables_hashed':60,'pending_sql_files_applied':5,'historical_schema_contracts_matched':9,
              'affected_schema_objects_matched':8}
        with patch.dict(os.environ,{'GITHUB_SHA':'a'*40}):
            report=private.safe_report(good)
            for key in ('production_accessed','production_changed','ledger_resolution_authorized','prisma_deploy_rehearsed',
                        'application_booking_concurrency_tested','post_migration_auth_storage_apis_tested'):
                self.assertIs(report[key],False)
            for bad in ({**good,'private_value':'do-not-publish'},{**good,'pending_sql_files_applied':4}):
                with self.assertRaises(pending.core.RestoreError): private.safe_report(bad)


if __name__=='__main__': unittest.main()
