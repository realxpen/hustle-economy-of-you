import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("private_cloud", Path(__file__).with_name("private_cloud.py"))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


class PrivateCloudTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        self.temp.cleanup()

    def test_secrets_are_consumed_without_prompt_or_inherited_child_environment(self):
        values = ("generated-service-account", "generated-backup-passphrase", "owner@hustle.invalid", "generated-account-password")
        with patch.dict(os.environ, dict(zip(p.SECRET_NAMES, values)), clear=True):
            inputs = p.take_inputs()
            self.assertEqual(inputs.backup_passphrase, values[1])
            self.assertTrue(all(k not in os.environ for k in p.SECRET_NAMES))
            self.assertTrue(all(value not in p.core.clean_environment().values() for value in values))
            self.assertNotIn(values[1], repr(inputs))

    def test_missing_secret_and_wrong_context_stop_before_any_download(self):
        with patch.dict(os.environ, {}, clear=True), self.assertRaises(p.core.RestoreError):
            p.take_inputs()
        with patch.dict(os.environ, {"GITHUB_REF": "refs/pull/123/merge"}, clear=True), self.assertRaises(p.core.RestoreError):
            p.guard()

    def test_main_only_guard_requires_exact_workflow_revision_and_generated_gate(self):
        env = {"GITHUB_WORKFLOW_REF": p.WORKFLOW, "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "workflow_dispatch",
               "GITHUB_JOB": "private-access", "HUSTLE_NATIVE_CONFIRM": p.CONFIRM, "HUSTLE_GENERATED_GATE": "passed",
               "GITHUB_SHA": "a" * 40, "RUNNER_TEMP": str(self.root)}
        with patch.dict(os.environ, env, clear=True), patch.object(p.core, "run", return_value=SimpleNamespace(stdout=b"a" * 40 + b"\n")), \
             patch.object(p.cloud, "preflight"), patch.object(p.cloud, "assert_clean"):
            self.assertEqual(p.guard(), self.root)
            for key, value in (("GITHUB_REF", "refs/heads/feature"), ("HUSTLE_GENERATED_GATE", ""),
                               ("HUSTLE_NATIVE_CONFIRM", ""), ("GITHUB_WORKFLOW_REF", "unrelated"),
                               ("GITHUB_SHA", "b" * 40), ("GITHUB_EVENT_NAME", "pull_request_target")):
                with self.subTest(key=key), patch.dict(os.environ, {key: value}), self.assertRaises(p.core.RestoreError):
                    p.guard()

    def test_google_signer_uses_only_fixed_oauth_endpoint_and_readonly_scope(self):
        key = subprocess.run(["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048"],
                             capture_output=True, check=True).stdout.decode()
        info = {"type": "service_account", "client_email": "fixture@fixture-project.iam.gserviceaccount.com",
                "token_uri": p.TOKEN_URL, "private_key": key, "private_key_id": "generated"}
        calls = []
        def refresh(_self, url, method="GET", body=None, headers=None, **kwargs):
            calls.append((url, method, body))
            return p.OAuthResponse(200, b'{"access_token":"generated-token","expires_in":3600,"token_type":"Bearer"}', {})
        with patch.object(p.Drive, "oauth_request", refresh):
            drive = p.Drive(json.dumps(info))
        self.assertEqual(drive.credentials.scopes, [p.SCOPE])
        self.assertEqual(calls[0][:2], (p.TOKEN_URL, "POST"))
        self.assertNotIn(key.encode(), calls[0][2])
        bad = dict(info, token_uri="https://unrelated.invalid/token")
        with self.assertRaises(p.core.RestoreError):
            p.Drive(json.dumps(bad))

    def test_google_transport_rejects_redirect_and_external_destinations(self):
        drive = object.__new__(p.Drive)
        drive.opener = SimpleNamespace(open=lambda *_args, **_kwargs: self.fail("External request attempted"))
        drive.credentials = SimpleNamespace(token="generated-token")
        for url in ("http://www.googleapis.com/drive/v3/files", "https://unrelated.invalid/drive/v3/files", "https://www.googleapis.com/other"):
            with self.assertRaises(p.core.RestoreError):
                drive.open(url)
        with self.assertRaises(p.core.RestoreError):
            drive.oauth_request("https://unrelated.invalid/token", method="POST")
        with self.assertRaises(p.core.RestoreError):
            p.NoRedirect().redirect_request(None)

    def test_drive_reader_paginates_empty_pages_and_rejects_duplicates_loops_and_public_acl(self):
        drive = object.__new__(p.Drive)
        folder = {"id": p.FOLDER, "mimeType": "application/vnd.google-apps.folder"}
        with patch.object(drive, "json", side_effect=[folder, {"nextPageToken": "next"}, {"files": [{"name": "one"}]}]):
            self.assertEqual(set(drive.list_files()), {"one"})
        for pages in ([folder, {"files": [{"name": "x"}], "nextPageToken": "n"}, {"files": [{"name": "x"}]}],
                      [folder, {"nextPageToken": "n"}, {"nextPageToken": "n"}],
                      [{**folder, "permissions": [{"type": "anyone", "role": "reader"}]}]):
            with patch.object(drive, "json", side_effect=pages), self.assertRaises(p.core.RestoreError):
                drive.list_files()

    def test_download_requires_original_membership_regular_files_exact_size_and_private_mode(self):
        drive = object.__new__(p.Drive)
        item = {"id": "generated-file-id", "parents": [p.FOLDER], "mimeType": "application/octet-stream", "size": "4"}
        target = self.root / "cipher.enc"
        with patch.object(drive, "open", return_value=io.BytesIO(b"file")):
            self.assertEqual(drive.download(item, target, 4), 4)
        self.assertEqual(target.stat().st_mode & 0o777, 0o600)
        for bad in (dict(item, parents=["unrelated"]), dict(item, mimeType="application/vnd.google-apps.document"), dict(item, size="5")):
            with self.assertRaises(p.core.RestoreError):
                drive.download(bad, self.root / "never", 4)
        for data in (b"bad", b"longer"):
            target.unlink()
            with patch.object(drive, "open", return_value=io.BytesIO(data)), self.assertRaises(p.core.RestoreError):
                drive.download(item, target, 4)

    def test_download_set_keeps_report_outside_exact_eleven_file_folder_and_checks_both_anchors(self):
        names = {p.core.SET_ID + suffix for suffix in p.core.SUFFIXES}
        names |= {x + ".sha256" for x in names}
        names |= {p.core.SET_ID + "-capture-inventory.json", p.core.SET_ID + "-capture-inventory.json.sha256", "READ_ME.txt", p.access.REPORT_NAME}
        class FakeDrive:
            def list_files(self): return {x: {"name": x} for x in names}
            def download(self, item, path, _limit): path.write_bytes(b"generated"); return 9
        with patch.object(p, "verify_report") as report, patch.object(p.core, "verify_backup") as backup:
            folder = p.download_set(FakeDrive(), self.root)
        self.assertEqual(len(list(folder.iterdir())), 11)
        report.assert_called_once_with(self.root / p.access.REPORT_NAME)
        backup.assert_called_once_with(folder)
        (self.root / "other").mkdir()
        with patch.object(FakeDrive, "list_files", return_value={}), self.assertRaises(p.core.RestoreError):
            p.download_set(FakeDrive(), self.root / "other")

    def test_corrupt_prior_report_is_rejected(self):
        path = self.root / "report.json"
        path.write_text('{"generated":"wrong report"}')
        with self.assertRaises(p.core.RestoreError):
            p.verify_report(path)

    def test_private_restore_failure_always_cleans_owned_stack(self):
        stack = SimpleNamespace(cleanup=lambda: None)
        inputs = p.Inputs("", "generated-passphrase", "owner@hustle.invalid", "generated-password")
        with patch.object(p.access, "Stack", return_value=stack), patch.object(stack, "cleanup") as cleanup, \
             patch.object(p.core, "read_reference", side_effect=p.core.RestoreError("BAD", "fixture")), self.assertRaises(p.core.RestoreError):
            p.restore_copy(self.root, inputs)
        cleanup.assert_called_once()

    def test_main_publishes_only_aggregate_after_container_and_encrypted_file_cleanup(self):
        inputs = p.Inputs("generated-SA", "generated-passphrase", "owner@hustle.invalid", "generated-password")
        result = {"owner_private_proofs_byte_verified": 2, "public_original_files_byte_verified": 0}
        class FakeDrive:
            def __init__(self, _raw): self.credentials = SimpleNamespace(token="generated")
        with patch.object(p, "take_inputs", return_value=inputs), patch.object(p, "guard", return_value=self.root), \
             patch.object(p, "Drive", FakeDrive), patch.object(p, "download_set", side_effect=lambda _drive, path: path), \
             patch.object(p, "restore_copy", return_value=result), patch.object(p.cloud, "assert_clean"), \
             contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(p.main([]), 0)
        path = self.root / "hustle-native-access-result.json"
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertIn("CHECK PASSED", output.getvalue())
        for value in ("owner@hustle.invalid", "generated-password", "generated-passphrase", "generated-SA"):
            self.assertNotIn(value, path.read_text() + output.getvalue())
        self.assertEqual(list(self.root.iterdir()), [path])
        self.assertIs(json.loads(path.read_text())["full_disaster_recovery_verified"], False)

    def test_cleanup_failure_or_invalid_result_cannot_publish_passing_report(self):
        inputs = p.Inputs("generated", "generated-passphrase", "owner@hustle.invalid", "generated-password")
        with patch.object(p, "take_inputs", return_value=inputs), patch.object(p, "guard", return_value=self.root), \
             patch.object(p, "Drive", return_value=SimpleNamespace(credentials=SimpleNamespace(token="generated"))), \
             patch.object(p, "download_set", side_effect=lambda _drive, path: path), patch.object(p, "restore_copy", return_value={}), \
             patch.object(p.cloud, "assert_clean", side_effect=p.core.RestoreError("CLEANUP", "fixture")), \
             contextlib.redirect_stdout(io.StringIO()) as output, contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(p.main([]), 1)
        self.assertNotIn("CHECK PASSED", output.getvalue())
        self.assertFalse((self.root / "hustle-native-access-result.json").exists())
        for result in ({}, {"owner_private_proofs_byte_verified": "email", "public_original_files_byte_verified": 0},
                       {"owner_private_proofs_byte_verified": 1, "public_original_files_byte_verified": 0, "email": "private"}):
            with self.assertRaises(p.core.RestoreError):
                p.safe_report(result)


if __name__ == "__main__":
    unittest.main()
