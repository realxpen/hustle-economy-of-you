import copy
import json
import os
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import MagicMock,patch

import final_acceptance as final


class AcceptanceTests(unittest.TestCase):
    def test_only_reviewed_successful_checksums_and_no_unresolved_failures(self):
        name=final.audit.PENDING[0]
        digest=final.audit.inventory()[1][name]
        valid={'id':'generated','migration_name':name,'checksum':digest,'finished_at':'generated','rolled_back_at':None}
        final.verify_history([valid],(name,))
        for rows in ([],[valid,valid],[dict(valid,checksum='0'*64)],
                     [valid,dict(valid,finished_at=None)]):
            with self.subTest(rows=rows),self.assertRaises(final.core.RestoreError):final.verify_history(rows,(name,))

    def test_external_url_never_reaches_node(self):
        runtime=final.Runtime(MagicMock())
        with patch.object(runtime,'guard'),patch.object(final.access,'private_run') as run,self.assertRaises(final.core.RestoreError):
            runtime.execute([], 'postgresql://live.example/postgres','GENERATED')
        run.assert_not_called()

    def test_private_child_output_is_never_in_error(self):
        runtime=final.Runtime(MagicMock())
        result=SimpleNamespace(returncode=1,stdout=b'private-value P3018',stderr=b'private SQL')
        with patch.object(runtime,'guard'),patch.object(final.access,'private_run',return_value=result),self.assertRaises(final.core.RestoreError) as raised:
            runtime.execute([],final.DEPLOY_URL,'PRISMA')
        self.assertEqual(raised.exception.code,'ACCEPTANCE_PRISMA_P3018')
        self.assertNotIn('private-value',raised.exception.message)
        self.assertNotIn('private SQL',raised.exception.message)

    def test_main_manual_job_gate_and_revision_guards(self):
        with tempfile.TemporaryDirectory() as root:
            env={'GITHUB_WORKFLOW_REF':final.WORKFLOW,'GITHUB_REF':'refs/heads/main','GITHUB_EVENT_NAME':'workflow_dispatch',
                 'GITHUB_JOB':'private-acceptance','HUSTLE_ACCEPTANCE_CONFIRM':final.CONFIRM,'HUSTLE_GENERATED_GATE':'passed',
                 'GITHUB_SHA':'a'*40,'RUNNER_TEMP':root}
            with patch.dict(os.environ,env,clear=True),patch.object(final.core,'run',return_value=SimpleNamespace(stdout=b'a'*40)),patch.object(final,'preflight'):
                self.assertEqual(final.guard(),Path(root))
                for key,value in [('GITHUB_REF','refs/heads/other'),('GITHUB_EVENT_NAME','pull_request'),
                                  ('GITHUB_JOB','generated-gate'),('HUSTLE_GENERATED_GATE',''),('GITHUB_SHA','b'*40),('GITHUB_HEAD_REF','other')]:
                    with patch.dict(os.environ,{key:value}),self.assertRaises(final.core.RestoreError):final.guard()

    def test_history_mismatch_prevents_resolve_and_deploy(self):
        database,runtime=MagicMock(),MagicMock()
        with patch.object(final.audit,'snapshot',return_value={}),patch.object(final.audit,'compare',return_value=[{'schema_contract_matched':True}]),\
             patch.object(final,'verify_live_media_reference'),patch.object(final.pending,'verify_source_pending'),\
             patch.object(final,'ledger',return_value=[]),self.assertRaises(final.core.RestoreError):
            final.upgrade(database,runtime,{}, {}, {}, [],generated=True)
        runtime.prisma.assert_not_called()

    def test_generated_cleanup_reverses_in_dependency_order(self):
        database,runtime=MagicMock(),MagicMock()
        with patch.object(final,'reference_contract',return_value=({}, {}, {}, [])),patch.object(final.access,'ApiDatabase',return_value=database),\
             patch.object(final,'Runtime',return_value=runtime),patch.object(final.audit,'reference_contract',side_effect=RuntimeError('generated failure')),\
             patch.object(final.core,'cleanup_all') as cleanup,self.assertRaises(RuntimeError):final.generated_contract()
        cleanup.assert_called_once_with([database,runtime])

    def test_private_stack_cleanup_even_if_node_cleanup_fails(self):
        stack,runtime=MagicMock(),MagicMock()
        with patch.object(final,'reference_contract',return_value=({}, {}, {}, [])),patch.object(final.access,'Stack',return_value=stack),\
             patch.object(final,'Runtime',return_value=runtime),patch.object(final.core,'read_reference',side_effect=RuntimeError('fixture')),\
             patch.object(final.core,'cleanup_all',side_effect=RuntimeError('cleanup')),self.assertRaises(RuntimeError):
            final.private_contract(Path('/generated'),SimpleNamespace(backup_passphrase='generated'))
        stack.cleanup.assert_called_once()

    def test_report_whitelist_and_explicit_limits(self):
        result={'original_non_prisma_tables_hashed':93,'private_proofs_verified':6,'public_files_verified':2,'reviewed_legacy_live_media_checksum_count':1}
        with patch.dict(os.environ,{'GITHUB_SHA':'a'*40}):
            report=final.report(result)
            self.assertEqual(report['successful_prisma_migrations'],41)
            self.assertFalse(report['production_history_resolution_authorized'])
            self.assertFalse(report['real_money_movement'])
            self.assertFalse(report['full_disaster_recovery_verified'])
            for bad in ({**result,'email':'private'},{**result,'private_proofs_verified':0}):
                with self.assertRaises(final.core.RestoreError):final.report(bad)

    def test_exact_original_live_media_checksum_needs_schema_proof(self):
        row={'id':'generated','migration_name':final.LIVE_MEDIA_MIGRATION,'checksum':final.LIVE_MEDIA_ORIGINAL_SHA,
             'finished_at':'generated','rolled_back_at':None}
        with self.assertRaises(final.core.RestoreError):final.verify_history([row],(final.LIVE_MEDIA_MIGRATION,))
        self.assertEqual(final.verify_history([row],(final.LIVE_MEDIA_MIGRATION,),legacy_schema_verified=True),1)
        with self.assertRaises(final.core.RestoreError):
            final.verify_history([dict(row,checksum='0'*64)],(final.LIVE_MEDIA_MIGRATION,),legacy_schema_verified=True)

    def test_live_media_schema_and_both_sql_digests_are_fail_closed(self):
        expected={'relation:LiveMediaPresence':{'rls':True,'grants':['api']}}
        final.verify_live_media_reference(expected,copy.deepcopy(expected))
        for actual in ({},{'relation:LiveMediaPresence':{'rls':False,'grants':['api']}}):
            with self.assertRaises(final.core.RestoreError):final.verify_live_media_reference(expected,actual)
        with patch.object(Path,'read_bytes',return_value=b'unknown SQL'),self.assertRaises(final.core.RestoreError):
            final.verify_live_media_reference(expected,expected)


if __name__=='__main__':unittest.main()
