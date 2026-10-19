import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class StorageBucketTests(unittest.TestCase):
    def run_creation(self, **overrides):
        repo = Path(__file__).resolve().parents[2]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / 'docker'
            docker.write_text(f'#!{sys.executable}\n' + '''
import os
from pathlib import Path
import sys

args = sys.argv[1:]
root = Path(os.environ['FAKE_DOCKER_ROOT'])
(root / 'called').touch()
assert args[0] == 'exec'
assert 'psql' in args
if '-f' in args:
    # Docker does not attach the caller's stdin without its interactive flag.
    attached = '-i' in args or '--interactive' in args
    sql = sys.stdin.read() if attached else ''
    (root / 'received.sql').write_text(sql)
    if os.environ.get('FAKE_IMPORT_FAIL'):
        sys.exit(1)
    if sql and not os.environ.get('FAKE_DROP_STDIN'):
        (root / 'created').touch()
elif '-Atqc' in args:
    default = '4:4:0' if (root / 'created').exists() else '0:0:0'
    print(os.environ.get('FAKE_BUCKET_STATE', default))
else:
    sys.exit(2)
''')
            docker.chmod(0o700)
            result = subprocess.run(
                ['bash', '-c', 'set -Eeuo pipefail; source "$1"; create_local_storage_buckets',
                 'storage-bucket-test', str(repo / 'scripts/recovery/storage-buckets.sh')],
                env={'PATH': directory + os.pathsep + os.environ['PATH'],
                     'DB_CONTAINER': 'supabase_db_hustle-cloud-restore',
                     'FAKE_DOCKER_ROOT': directory, **overrides},
                capture_output=True, text=True, check=False,
            )
            sql = root / 'received.sql'
            return result, sql.read_text() if sql.exists() else '', (root / 'called').exists()

    def test_bucket_creation_sql_reaches_container_stdin(self):
        result, sql, called = self.run_creation()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(called)
        self.assertIn('INSERT INTO storage.buckets', sql)
        for bucket in ('agent-proofs', 'hustler-proofs', 'message-attachments', 'story-media'):
            self.assertIn(bucket, sql)
        self.assertIn('PASS: four named local Storage buckets exist', result.stdout)

    def test_successful_noop_import_is_rejected(self):
        result, _, _ = self.run_creation(FAKE_DROP_STDIN='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('zero objects before uploads', result.stderr)
        self.assertNotIn('PASS:', result.stdout)

    def test_wrong_bucket_names_or_nonempty_storage_are_rejected(self):
        for state in ('4:3:0', '4:4:1'):
            with self.subTest(state=state):
                result, _, _ = self.run_creation(FAKE_BUCKET_STATE=state)
                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn('PASS:', result.stdout)

    def test_import_failure_stops_creation(self):
        result, _, _ = self.run_creation(FAKE_IMPORT_FAIL='1')
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('bucket creation failed', result.stderr)
        self.assertNotIn('PASS:', result.stdout)

    def test_unexpected_container_is_rejected_before_docker(self):
        result, _, called = self.run_creation(DB_CONTAINER='unexpected-container')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(called)


if __name__ == '__main__':
    unittest.main()
