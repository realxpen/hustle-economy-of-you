import copy
import json
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import migration_audit as audit
import private_migration_audit as private


class AuditTests(unittest.TestCase):
    def setUp(self):
        self.expected = {'relation:AgentApplication': {'rls': True, 'columns': ['id'], 'acl': ['hustle_api']},
                         'role:hustle_api': {'bypass_rls': False}}
        self.scopes = {name: list(self.expected) for name in audit.HISTORICAL}

    def test_reviewed_inventory_has_27_plus_9_plus_5_exact_names_and_hashes(self):
        baseline, hashes = audit.inventory()
        self.assertEqual((len(baseline), len(audit.HISTORICAL), len(audit.PENDING), len(hashes)), (27, 9, 5, 41))
        self.assertIn(audit.SKIP, baseline)
        self.assertTrue(all(len(h) == 64 for h in hashes.values()))

    def test_exact_reference_matches_every_historical_scope(self):
        self.assertTrue(all(x['schema_contract_matched'] for x in audit.compare(self.expected, self.expected, self.scopes)))

    def test_absent_object_never_matches(self):
        actual = dict(self.expected)
        del actual['relation:AgentApplication']
        self.assertTrue(all(not x['schema_contract_matched'] for x in audit.compare(self.expected, actual, self.scopes)))

    def test_extra_columns_rls_changes_and_acl_changes_are_detected(self):
        for key, value in [('columns', ['id', 'unexpected']), ('rls', False), ('acl', ['hustle_api', 'anon'])]:
            actual = copy.deepcopy(self.expected)
            actual['relation:AgentApplication'][key] = value
            self.assertFalse(audit.compare(self.expected, actual, self.scopes)[0]['schema_contract_matched'])

    def test_role_bypass_changes_are_detected(self):
        actual = copy.deepcopy(self.expected)
        actual['role:hustle_api']['bypass_rls'] = True
        self.assertFalse(audit.compare(self.expected, actual, self.scopes)[0]['schema_contract_matched'])

    def test_report_does_not_expose_actual_definitions_or_unrelated_private_names(self):
        actual = dict(self.expected, **{'relation:private-user-supplied-name': {'private': 'private-row-data'}})
        result = json.dumps(audit.compare(self.expected, actual, self.scopes))
        self.assertNotIn('private-user', result)
        self.assertNotIn('private-row-data', result)
        self.assertNotIn('columns', result)

    def test_removed_reference_object_is_checked_for_absence(self):
        expected = dict(self.expected)
        del expected['relation:AgentApplication']
        self.assertFalse(audit.compare(expected, self.expected, self.scopes)[0]['schema_contract_matched'])

    def test_snapshot_is_explicitly_read_only(self):
        with patch.object(audit.access, 'private_sql', return_value=b'{}') as query:
            self.assertEqual(audit.snapshot(object()), {})
            sql = query.call_args.args[1]
            self.assertTrue(sql.startswith('BEGIN READ ONLY;'))
            self.assertTrue(sql.endswith('COMMIT;'))

    def test_only_two_existing_secrets_are_read_and_removed(self):
        with patch.dict(os.environ, dict(zip(private.SECRETS, ('generated-sa', 'generated-backup-passphrase'))), clear=True):
            self.assertEqual(private.take_inputs(), ('generated-sa', 'generated-backup-passphrase'))
            self.assertFalse(any(k in os.environ for k in private.SECRETS))
        self.assertFalse(any('OWNER' in k for k in private.SECRETS))

    def test_missing_secrets_and_line_break_passphrase_are_rejected(self):
        for values in [('', ''), ('generated-sa', 'short'), ('generated-sa', 'generated-passphrase\n')]:
            with patch.dict(os.environ, dict(zip(private.SECRETS, values)), clear=True), self.assertRaises(audit.core.RestoreError):
                private.take_inputs()

    def test_guard_requires_exact_main_manual_job_gate_and_revision(self):
        with tempfile.TemporaryDirectory() as root:
            env = {'GITHUB_WORKFLOW_REF': private.WORKFLOW, 'GITHUB_REF': 'refs/heads/main',
                   'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_JOB': 'private-audit',
                   'HUSTLE_AUDIT_CONFIRM': private.CONFIRM, 'HUSTLE_GENERATED_GATE': 'passed',
                   'GITHUB_SHA': 'a' * 40, 'RUNNER_TEMP': root}
            with patch.dict(os.environ, env, clear=True), patch.object(audit.core, 'run', return_value=SimpleNamespace(stdout=b'a' * 40)), \
                 patch.object(audit.cloud, 'preflight'), patch.object(audit.cloud, 'assert_clean'):
                self.assertEqual(private.guard(), Path(root))
                for key, value in [('GITHUB_REF', 'refs/heads/feature'), ('GITHUB_EVENT_NAME', 'pull_request_target'),
                                   ('GITHUB_JOB', 'other-job'), ('GITHUB_SHA', 'b' * 40), ('GITHUB_HEAD_REF', 'feature'),
                                   ('HUSTLE_GENERATED_GATE', ''), ('HUSTLE_AUDIT_CONFIRM', ''), ('GITHUB_WORKFLOW_REF', 'other')]:
                    with self.subTest(key=key), patch.dict(os.environ, {key: value}), self.assertRaises(audit.core.RestoreError):
                        private.guard()

    def test_diagnostic_report_never_authorizes_ledger_resolution(self):
        with patch.dict(os.environ, {'GITHUB_SHA': 'a' * 40}):
            for matched in (True, False):
                result = private.safe_report({'historical_schema_contracts_all_matched': matched})
                for key in ('production_accessed', 'production_changed', 'ledger_resolution_authorized',
                            'full_migration_equivalence_certified', 'actual_pending_migrations_rehearsed'):
                    self.assertIs(result[key], False)

    def test_no_pending_sql_is_run_on_actual_backup_container(self):
        # Architectural regression: audit_copy can import, snapshot and compare;
        # only generated reference code is allowed to execute repository SQL.
        import inspect
        source = inspect.getsource(private.audit_copy)
        self.assertNotIn('apply_reference(', source)
        self.assertNotIn('SET ROLE', source)
        self.assertNotIn('migrate resolve', source)
        self.assertNotIn('migrate deploy', source)
        self.assertIn('core.cleanup_all', source)


if __name__ == '__main__':
    unittest.main()
