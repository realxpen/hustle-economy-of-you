"""Strict metadata and encrypted-byte checks; never decrypts or restores data."""
from datetime import datetime
import hashlib
import json
from pathlib import Path
import re
import stat

from fetch_backups import parse_checksum

SOURCE_PROJECT = 'pfgarmyygybmhiiuopym'
MAX_MANIFEST = 64 * 1024
MAX_ARCHIVE = 512 * 1024 * 1024
MAX_CHECKSUM = 512
EXTENSIONS = {'application': '.tar.gz.enc', 'auth': '.sql.gz.enc',
              'storage_metadata': '.sql.gz.enc', 'storage_files': '.tar.gz.enc'}
COVERAGE = {
    'application': {'application_schema', 'application_data', 'roles_grants',
                    'prisma_history', 'supabase_history'},
    'auth': {'users', 'identities', 'auth_configuration'},
    'storage_metadata': {'buckets', 'objects', 'policies'},
    'storage_files': {'object_bytes', 'file_hash_manifest'},
}
COUNT_KEYS = {'application': {'users', 'services', 'bookings', 'notifications'},
              'auth': {'users', 'identities'}, 'storage': {'buckets', 'objects'}}


class ManifestError(ValueError):
    """A fixed validation message that contains no operator-supplied values."""


def require(condition, message):
    if not condition:
        raise ManifestError(message)


def keys(value, expected):
    require(isinstance(value, dict) and set(value) == set(expected),
            'Unexpected or missing manifest fields')


def digest(value):
    require(isinstance(value, str) and re.fullmatch(r'[a-f0-9]{64}', value),
            'Invalid SHA-256 digest')
    return value


def timestamp(value):
    require(isinstance(value, str) and re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ', value),
            'Capture times must be UTC timestamps')
    return datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ')


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, 'Duplicate JSON field')
        value[key] = item
    return value


def read_json(data):
    require(len(data) <= MAX_MANIFEST, 'Manifest is too large')
    return json.loads(data, object_pairs_hook=unique_object)


def validate_manifest(value):
    keys(value, {'schema_version', 'backup_set_id', 'source_project_ref', 'capture',
                 'archives', 'declared_coverage', 'expected_counts'})
    require(type(value['schema_version']) is int and value['schema_version'] == 1,
            'Unsupported manifest version')
    set_id = value['backup_set_id']
    require(isinstance(set_id, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}', set_id),
            'Invalid backup set ID')
    require(value['source_project_ref'] == SOURCE_PROJECT, 'Unexpected source project')
    capture = value['capture']
    keys(capture, {'started_at', 'ended_at', 'consistency', 'evidence_ref'})
    start, end = timestamp(capture['started_at']), timestamp(capture['ended_at'])
    require(start < end, 'Invalid capture window')
    require(capture['consistency'] == 'operator_declared_write_freeze',
            'A write-freeze declaration is required')
    reference = capture['evidence_ref']
    require(isinstance(reference, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,79}', reference),
            'Invalid capture evidence reference')
    require(not reference.startswith('replace-'), 'Replace the example capture reference')
    keys(value['archives'], EXTENSIONS)
    keys(value['declared_coverage'], EXTENSIONS)
    for kind, extension in EXTENSIONS.items():
        archive = value['archives'][kind]
        keys(archive, {'filename', 'captured_at', 'sha256', 'size_bytes'})
        require(archive['filename'] == f'{set_id}-{kind}{extension}',
                'Archive filename does not belong to this backup set')
        require(start <= timestamp(archive['captured_at']) <= end,
                'Component capture is outside the declared window')
        digest(archive['sha256'])
        require(type(archive['size_bytes']) is int and 0 < archive['size_bytes'] <= MAX_ARCHIVE,
                'Invalid encrypted archive size')
        coverage = value['declared_coverage'][kind]
        require(isinstance(coverage, list) and all(isinstance(item, str) for item in coverage)
                and len(coverage) == len(set(coverage)) and set(coverage) == COVERAGE[kind],
                'Incomplete or unexpected coverage declaration')
    keys(value['expected_counts'], COUNT_KEYS)
    for group, fields in COUNT_KEYS.items():
        counts = value['expected_counts'][group]
        keys(counts, fields)
        require(all(type(number) is int and 0 <= number <= 1_000_000_000
                    for number in counts.values()), 'Invalid expected counts')
    return value


def load_manifest(data, expected_sha256):
    digest(expected_sha256)
    require(hashlib.sha256(data).hexdigest() == expected_sha256, 'Manifest fingerprint mismatch')
    return validate_manifest(read_json(data))


def regular_file(path, maximum):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_size <= maximum,
            'Expected a bounded regular file, not a symlink')
    return info.st_size


def verify_local_set(manifest, directory):
    validate_manifest(manifest)
    root = Path(directory)
    require(root.is_dir() and not root.is_symlink(), 'Invalid backup directory')
    for archive in manifest['archives'].values():
        path = root / archive['filename']
        require(regular_file(path, MAX_ARCHIVE) == archive['size_bytes'], 'Archive size mismatch')
        sidecar = root / (archive['filename'] + '.sha256')
        regular_file(sidecar, MAX_CHECKSUM)
        require(parse_checksum(sidecar.read_bytes(), archive['filename']) == archive['sha256'],
                'Checksum sidecar disagrees with manifest')
        with path.open('rb') as source:
            require(hashlib.file_digest(source, 'sha256').hexdigest() == archive['sha256'],
                    'Encrypted archive digest mismatch')
    return manifest
