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
