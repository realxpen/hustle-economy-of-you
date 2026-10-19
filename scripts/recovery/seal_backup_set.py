#!/usr/bin/env python3
"""Seal a private operator draft using already encrypted local files only."""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import sys

from backup_manifest import (EXTENSIONS, MAX_ARCHIVE, MAX_CHECKSUM, ManifestError, keys, read_json,
                             regular_file, require, validate_manifest, verify_local_set)


def write_private(path, data):
    with path.open('xb') as target:
        path.chmod(0o600)
        target.write(data)


def seal(draft, directory):
    root = Path(directory)
    require(root.is_absolute() and root.is_dir() and not root.is_symlink(),
            'Use an absolute private backup directory')
    require(root.stat().st_mode & 0o077 == 0, 'Backup directory must be owner-only')
    value = deepcopy(draft)
    keys(value.get('archives'), EXTENSIONS)
    for archive in value['archives'].values():
        keys(archive, {'filename', 'captured_at'})
        archive.update(sha256='0' * 64, size_bytes=1)
    # Validate every name and all metadata before touching any archive path.
    validate_manifest(value)
    for archive in value['archives'].values():
        path = root / archive['filename']
        archive['size_bytes'] = regular_file(path, MAX_ARCHIVE)
        with path.open('rb') as source:
            archive['sha256'] = hashlib.file_digest(source, 'sha256').hexdigest()
    validate_manifest(value)
    name = value['backup_set_id'] + '.manifest.json'
    data = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    fingerprint = hashlib.sha256(data).hexdigest()
    outputs = {root / name: data,
               root / (name + '.sha256'): f'{fingerprint}  {name}\n'.encode()}
    for path in outputs:
        require(not path.exists() and not path.is_symlink(), 'Refusing to replace an existing manifest')
    for archive in value['archives'].values():
        path = root / (archive['filename'] + '.sha256')
        contents = f"{archive['sha256']}  {archive['filename']}\n".encode()
        if path.exists() or path.is_symlink():
            regular_file(path, MAX_CHECKSUM)
            require(path.read_bytes() == contents, 'Refusing to replace a conflicting checksum')
        else:
            outputs[path] = contents
    for path, contents in outputs.items():
        write_private(path, contents)
    verify_local_set(value, root)
    return root / name, fingerprint


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--draft', type=Path, required=True)
    parser.add_argument('--directory', type=Path, required=True)
    args = parser.parse_args()
    try:
        regular_file(args.draft, 64 * 1024)
        _, fingerprint = seal(read_json(args.draft.read_bytes()), args.directory)
        print('Manifest sealed locally. Retain this independently for the manual preflight.')
        print('Manifest SHA-256: ' + fingerprint)
    except ManifestError as error:
        print('STOP: ' + str(error) + '.', file=sys.stderr)
        sys.exit(1)
    except Exception:
        print('STOP: draft, private file or integrity validation failed (details withheld).', file=sys.stderr)
        sys.exit(1)
