import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("cloud_contract", Path(__file__).with_name("cloud_contract.py"))
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)
ENV = {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted",
       "GITHUB_REPOSITORY": "realxpen/hustle-economy-of-you", "GITHUB_EVENT_NAME": "pull_request"}


class CloudContractTests(unittest.TestCase):
    def preflight(self, extra=None):
        def run(args, **kwargs):
            body = json.dumps("unix:///var/run/docker.sock").encode() if "context" in args else b""
            return subprocess.CompletedProcess(args, 0, body, b"")
        with patch.dict(os.environ, {**ENV, **(extra or {})}, clear=True), \
             patch.object(cloud.sys, "platform", "linux"), patch.object(cloud.os, "getuid", return_value=1001), \
             patch.object(cloud.shutil, "which", return_value="/usr/bin/generated"), \
             patch.object(cloud.core, "run", side_effect=run):
            cloud.preflight()

    def test_generated_job_requires_no_terminal_or_secrets(self):
        self.preflight()

    def test_private_credentials_and_unsafe_contexts_are_rejected(self):
        for extra in ({"HUSTLE_RESTORE_APP_PASSPHRASE": "fixture"}, {"PGPASSWORD": "fixture"},
                      {"SUPABASE_ACCESS_TOKEN": "fixture"}, {"DATABASE_URL": "fixture"},
                      {"DOCKER_HOST": "tcp://production.invalid:2375"}, {"RUNNER_ENVIRONMENT": "self-hosted"},
                      {"GITHUB_EVENT_NAME": "pull_request_target"}, {"GITHUB_REPOSITORY": "unrelated/repository"}):
            with self.subTest(extra=list(extra)), self.assertRaises(cloud.core.RestoreError):
                self.preflight(extra)

    def test_main_only_calls_generated_contracts_never_private_entry_points(self):
        calls = []
        def record(name): return lambda: calls.append(name)
        with patch.object(cloud, "preflight", side_effect=record("preflight")), \
             patch.object(cloud, "assert_clean", side_effect=record("clean")), \
             patch.object(cloud.core, "synthetic_contract", side_effect=record("native")), \
             patch.object(cloud.access, "generated_contract", side_effect=record("api")), \
             patch.object(cloud.core, "main", side_effect=AssertionError("private entry point")), \
             patch.object(cloud.access, "main", side_effect=AssertionError("private entry point")), \
             patch.object(cloud.core, "verify_backup", side_effect=AssertionError("private backup")), \
             patch.object(cloud.access, "verify_report", side_effect=AssertionError("private report")), \
             patch.object(cloud.access.getpass, "getpass", side_effect=AssertionError("private prompt")), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(cloud.main([]), 0)
        self.assertEqual(calls, ["preflight", "clean", "native", "clean", "api", "clean"])
        self.assertIn("CONTRACTS PASSED", output.getvalue())
        self.assertIn("remain unverified", output.getvalue())

    def test_cleanup_failure_cannot_report_a_pass(self):
        with patch.object(cloud, "preflight"), patch.object(cloud.core, "synthetic_contract"), \
             patch.object(cloud.access, "generated_contract"), \
             patch.object(cloud, "assert_clean", side_effect=[None, None, cloud.core.RestoreError("GENERATED_CLEANUP", "fixture")]), \
             contextlib.redirect_stdout(io.StringIO()) as output, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cloud.main([]), 1)
        self.assertNotIn("CONTRACTS PASSED", output.getvalue())

    def test_native_failure_prevents_api_run_and_never_reports_a_pass(self):
        with patch.object(cloud, "preflight"), patch.object(cloud, "assert_clean"), \
             patch.object(cloud.core, "synthetic_contract", side_effect=cloud.core.RestoreError("NATIVE", "fixture")), \
             patch.object(cloud.access, "generated_contract") as api, \
             contextlib.redirect_stdout(io.StringIO()) as output, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(cloud.main([]), 1)
        api.assert_not_called()
        self.assertNotIn("CONTRACTS PASSED", output.getvalue())


if __name__ == "__main__":
    unittest.main()
