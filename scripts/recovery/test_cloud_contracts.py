import hashlib
import io
from pathlib import Path
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest

sys.path.insert(0,str(Path(__file__).parent))
from fetch_backups import FOLDER, list_backup_files, parse_checksum
from safe_extract import extract
from verify_metadata import copy_count


class StrictDriveFiles:
    """Offline fake with Drive v3's keyword names and paginated responses."""

    def __init__(self, pages):
        self.pages = pages
        self.tokens = []
        self.queries = []

    def list(self, *, q, fields, pageSize, pageToken=None):
        self.tokens.append(pageToken)
        self.queries.append(q)
        return SimpleNamespace(execute=lambda: self.pages[pageToken])


class CloudRecoveryContractTests(unittest.TestCase):
    def test_drive_inventory_pagination_including_empty_page(self):
        first = {'id': 'fake-archive', 'name': 'example.enc'}
        last = {'id': 'fake-checksum', 'name': 'example.enc.sha256'}
        files_api = StrictDriveFiles({
            None: {'files': [first], 'nextPageToken': 'second'},
            'second': {'files': [], 'nextPageToken': 'third'},
            'third': {'files': [last]},
        })
        drive = SimpleNamespace(files=lambda: files_api)

        self.assertEqual(list_backup_files(drive), {
            'example.enc': first, 'example.enc.sha256': last,
        })
        self.assertEqual(files_api.tokens, [None, 'second', 'third'])
        self.assertEqual(files_api.queries, [
            f"'{FOLDER}' in parents and trashed = false",
        ] * 3)

    def test_drive_duplicate_names_across_pages_fail(self):
        files_api = StrictDriveFiles({
            None: {'files': [{'id': 'first', 'name': 'example.enc'}],
                   'nextPageToken': 'second'},
            'second': {'files': [{'id': 'duplicate', 'name': 'example.enc'}]},
        })
        drive = SimpleNamespace(files=lambda: files_api)

        with self.assertRaisesRegex(ValueError, 'Duplicate file name'):
            list_backup_files(drive)

    def test_exact_checksum_filename(self):
        checksum=hashlib.sha256(b'x').hexdigest()
        self.assertEqual(parse_checksum((checksum+'  expected.enc\n').encode(),'expected.enc'),checksum)
        with self.assertRaises(ValueError):
            parse_checksum((checksum+'  other.enc\n').encode(),'expected.enc')

    def test_untrusted_tar_traversal_fails(self):
        out=io.BytesIO()
        with tarfile.open(fileobj=out,mode='w:gz') as z:
            info=tarfile.TarInfo('../unsafe.txt')
            info.size=1
            z.addfile(info,io.BytesIO(b'x'))
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                extract(io.BytesIO(out.getvalue()),tmp)
            self.assertFalse((Path(tmp)/'..'/'unsafe.txt').exists())

    def test_safe_tar_entries(self):
        out=io.BytesIO()
        with tarfile.open(fileobj=out,mode='w:gz') as z:
            info=tarfile.TarInfo('./')
            info.type=tarfile.DIRTYPE
            z.addfile(info)
            f=tarfile.TarInfo('./schema.sql')
            f.size=2
            z.addfile(f,io.BytesIO(b'OK'))
        with tempfile.TemporaryDirectory() as tmp:
            extract(io.BytesIO(out.getvalue()),tmp)
            self.assertEqual((Path(tmp)/'schema.sql').read_bytes(),b'OK')

    def test_copy_metadata_counts(self):
        sample='COPY storage.buckets (id) FROM stdin;\na\nb\n\\.\nCOPY storage.objects (id) FROM stdin;\nc\n\\.\n'
        self.assertEqual(copy_count(sample,'buckets'),2)
        self.assertEqual(copy_count(sample,'objects'),1)

if __name__=='__main__':
    unittest.main()
