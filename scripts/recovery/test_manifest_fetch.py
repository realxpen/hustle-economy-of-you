from copy import deepcopy
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from fetch_backups import FOLDER
from fetch_backup_set import check_guards, download_file, preflight
from test_backup_manifest import sealed_fixture


class FakeDownload:
    def __init__(self, target, request, chunksize):
        self.target, self.data = target, request

    def next_chunk(self):
        self.target.write(self.data)
        return None, True


class FakeDrive:
    def __init__(self, directory):
        self.data = {path.name: path.read_bytes() for path in directory.iterdir()}
        self.items = [dict(id=name, name=name, size=str(len(data)),
                           mimeType='application/octet-stream') for name, data in self.data.items()]
        self.downloads = []

    def files(self):
        return self

    def list(self, *, q, fields, pageSize, pageToken=None):
        return SimpleNamespace(execute=lambda: {'files': self.items})

    def get_media(self, *, fileId):
        self.downloads.append(fileId)
        return self.data[fileId]


class ManifestFetchTests(unittest.TestCase):
    def test_fake_drive_round_trip_uses_only_selected_encrypted_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'
            source.mkdir(mode=0o700)
            path, fingerprint, manifest = sealed_fixture(source)
            drive = FakeDrive(source)
            result = preflight(drive, root / 'download', path.name, fingerprint, FakeDownload)
            self.assertEqual(result, manifest)
            self.assertEqual(len(drive.downloads), 9)
            self.assertNotIn(path.name + '.sha256', drive.downloads)
            self.assertEqual((root / 'download').stat().st_mode & 0o777, 0o700)

    def test_bad_manifest_pin_incomplete_set_and_duplicate_names_fail_before_archive_reads(self):
        for failure in ('pin', 'missing', 'duplicate'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                source = root / 'source'
                source.mkdir(mode=0o700)
                path, fingerprint, manifest = sealed_fixture(source)
                drive = FakeDrive(source)
                if failure == 'pin':
                    fingerprint = '0' * 64
                elif failure == 'missing':
                    missing = manifest['archives']['auth']['filename']
                    drive.items = [item for item in drive.items if item['name'] != missing]
                else:
                    drive.items.append(deepcopy(drive.items[0]))
                with self.assertRaises(ValueError):
                    preflight(drive, root / 'download', path.name, fingerprint, FakeDownload)
                self.assertLessEqual(len(drive.downloads), 1)
                self.assertTrue(all(name.endswith('.manifest.json') for name in drive.downloads))

    def test_corrupted_archive_bytes_fail_even_when_size_is_unchanged(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / 'source'
            source.mkdir(mode=0o700)
            path, fingerprint, manifest = sealed_fixture(source)
            drive = FakeDrive(source)
            filename = manifest['archives']['application']['filename']
            drive.data[filename] = b'x' * len(drive.data[filename])
            with self.assertRaisesRegex(ValueError, 'digest'):
                preflight(drive, root / 'download', path.name, fingerprint, FakeDownload)

    def test_download_rejects_converted_oversized_and_truncated_files(self):
        for failure in ('converted', 'metadata-size', 'overflow', 'truncated'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as directory:
                data = {'sample': b'fixture'}
                drive = SimpleNamespace(files=lambda: SimpleNamespace(get_media=lambda **_: data['sample']))
                item = dict(id='sample', mimeType='application/octet-stream', size='7')
                if failure == 'converted':
                    item['mimeType'] = 'application/vnd.google-apps.document'
                elif failure == 'metadata-size':
                    item['size'] = '99999'
                elif failure == 'overflow':
                    item['size'] = '6'
                else:
                    item['size'] = '8'
                with self.assertRaises(ValueError):
                    download_file(drive, item, Path(directory) / 'file', 32, factory=FakeDownload)

    def test_runtime_guards_require_manual_main_and_no_database_credentials(self):
        with tempfile.TemporaryDirectory() as directory:
            env = dict(GITHUB_ACTIONS='true', GITHUB_EVENT_NAME='workflow_dispatch',
                       GITHUB_REF='refs/heads/main', HUSTLE_PREFLIGHT_CONFIRM='VERIFY_ENCRYPTED_SET',
                       HUSTLE_BACKUP_FOLDER_ID=FOLDER, HUSTLE_RESTORE_DRIVE_SA_JSON='fake-reader-only',
                       RUNNER_TEMP=directory, HUSTLE_PREFLIGHT_MANIFEST_NAME='synthetic.manifest.json',
                       HUSTLE_PREFLIGHT_MANIFEST_SHA256='a' * 64)
            with patch.dict(os.environ, env, clear=True):
                self.assertEqual(check_guards()[0], Path(directory) / 'hustle-manifest-preflight')
            for change in ({'GITHUB_EVENT_NAME': 'pull_request'}, {'GITHUB_REF': 'refs/heads/feature'},
                           {'HUSTLE_PREFLIGHT_CONFIRM': 'wrong'}, {'DATABASE_URL': 'fake-private-url'},
                           {'SUPABASE_ACCESS_TOKEN': 'fake-token'}, {'HUSTLE_BACKUP_FOLDER_ID': 'other'},
                           {'HUSTLE_PREFLIGHT_MANIFEST_NAME': '../unsafe.manifest.json'}):
                with self.subTest(change=next(iter(change))), patch.dict(os.environ, {**env, **change}, clear=True):
                    with self.assertRaises(ValueError):
                        check_guards()

    def test_cli_failure_keeps_environment_values_private(self):
        script = Path(__file__).parent / 'fetch_backup_set.py'
        result = subprocess.run([sys.executable, str(script)],
                                env={'PATH': os.environ['PATH'], 'DATABASE_URL': 'fake-hidden-credential',
                                     'PYTHONDONTWRITEBYTECODE': '1'},
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(result.stdout, '')
        self.assertNotIn('fake-hidden-credential', result.stderr)
        self.assertEqual(result.stderr,
                         'STOP: encrypted backup-set preflight failed (private details withheld).\n')
