import os
from pathlib import Path
import subprocess
import tempfile
import unittest

from report_storage_error import classify_storage_error, summary


class StorageErrorTests(unittest.TestCase):
    def test_known_errors_have_fixed_categories(self):
        cases = {
            'unknown flag: --local': 'CLI_FLAG_UNSUPPORTED',
            'mime type application/octet-stream is not supported': 'MIME_TYPE_REJECTED',
            'Payload too large': 'FILE_SIZE_REJECTED',
            'Invalid JWT signature': 'LOCAL_AUTH_REJECTED',
            'new row violates row-level security policy': 'LOCAL_ACCESS_DENIED',
            'Bucket not found': 'LOCAL_BUCKET_MISSING',
            'The resource already exists': 'LOCAL_OBJECT_EXISTS',
            'dial tcp: connection refused': 'LOCAL_CONNECTION_FAILED',
            'open private-file: no such file or directory': 'LOCAL_FILE_MISSING',
            'unexpected internal error': 'UNCLASSIFIED_STORAGE_ERROR',
        }
        for message, expected in cases.items():
            with self.subTest(expected=expected):
                self.assertEqual(classify_storage_error(message), expected)

    def test_summary_does_not_publish_private_output(self):
        sensitive = 'Authorization: Bearer fake-private-token\n/private/customer/proof.pdf'
        self.assertEqual(summary(sensitive + '\nUnauthorized', 'upload'),
                         'Local Storage upload: LOCAL_AUTH_REJECTED (private details withheld).')
        self.assertEqual(summary(sensitive, 'download'),
                         'Local Storage download: UNCLASSIFIED_STORAGE_ERROR (private details withheld).')
        with self.assertRaises(ValueError):
            summary(sensitive, sensitive)

    def test_copy_wrapper_keeps_both_output_streams_private(self):
        repo = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cli = root / 'supabase'
            cli.write_text('#!/bin/sh\nprintf "fake-private-token\\n"\n'
                           'printf "Unauthorized /private/customer/proof.pdf\\n" >&2\nexit 1\n')
            cli.chmod(0o700)
            result = subprocess.run(
                ['bash', '-c', 'umask 077; source "$1"; copy_local_storage upload "$2" "$3"',
                 'storage-copy-test', str(repo / 'scripts/recovery/storage-copy.sh'),
                 'fake-private.pdf', 'ss:///agent-proofs/fake.pdf'],
                env={'PATH': directory + os.pathsep + os.environ['PATH'],
                     'RUNNER_TEMP': directory, 'GITHUB_WORKSPACE': str(repo)},
                capture_output=True, text=True, check=False,
            )
            self.assertEqual(result.returncode, 1)
            self.assertEqual(result.stdout, '')
            self.assertIn('LOCAL_AUTH_REJECTED', result.stderr)
            self.assertNotIn('fake-private-token', result.stderr)
            self.assertNotIn('/private/customer/proof.pdf', result.stderr)
            private_log = root / 'storage-api-private.log'
            self.assertIn('fake-private-token', private_log.read_text())
            self.assertEqual(private_log.stat().st_mode & 0o077, 0)
