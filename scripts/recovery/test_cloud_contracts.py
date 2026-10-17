import hashlib
import io
from pathlib import Path
import sys
import tarfile
import tempfile
import unittest

sys.path.insert(0,str(Path(__file__).parent))
from fetch_backups import parse_checksum
from safe_extract import extract
from verify_metadata import copy_count

class CloudRecoveryContractTests(unittest.TestCase):
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
