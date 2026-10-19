#!/usr/bin/env python3
"""Verify a pinned encrypted backup set from Drive; no decryption or restore."""
import json
import os
from pathlib import Path
import re
import sys

from backup_manifest import (MAX_ARCHIVE, MAX_CHECKSUM, MAX_MANIFEST, digest,
                             load_manifest, require, verify_local_set)
from fetch_backups import FOLDER, list_backup_files, parse_checksum


def manifest_inputs(name, fingerprint):
    require(isinstance(name, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.manifest\.json', name),
            'Invalid manifest filename')
    digest(fingerprint)


def check_guards():
    require(os.getenv('GITHUB_ACTIONS') == 'true'
            and os.getenv('GITHUB_EVENT_NAME') == 'workflow_dispatch'
            and os.getenv('GITHUB_REF') == 'refs/heads/main'
            and os.getenv('HUSTLE_PREFLIGHT_CONFIRM') == 'VERIFY_ENCRYPTED_SET',
            'Manual main-branch preflight confirmation is required')
    require(not any(os.getenv(name) for name in (
        'DATABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_ACCESS_TOKEN',
        'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_AUTH_SERVICE_ROLE_KEY')),
        'Unexpected production-capable environment variable')
    require(os.getenv('HUSTLE_BACKUP_FOLDER_ID') == FOLDER, 'Unexpected Drive folder')
    require(bool(os.getenv('HUSTLE_RESTORE_DRIVE_SA_JSON')), 'Missing dedicated Drive reader')
    root = Path(os.environ['RUNNER_TEMP'])
    require(root.is_absolute() and root.is_dir() and not root.is_symlink()
            and root.resolve() not in (Path('/'), Path('/tmp')), 'Unsafe runner directory')
    name = os.getenv('HUSTLE_PREFLIGHT_MANIFEST_NAME', '')
    fingerprint = os.getenv('HUSTLE_PREFLIGHT_MANIFEST_SHA256', '').strip().lower()
    manifest_inputs(name, fingerprint)
    return root / 'hustle-manifest-preflight', name, fingerprint


def download_file(drive, item, path, maximum, expected_size=None, factory=None):
    require(isinstance(item.get('mimeType'), str)
            and not item['mimeType'].startswith('application/vnd.google-apps.'),
            'Expected a raw Drive file')
    size = item.get('size', '')
    require(isinstance(size, str) and re.fullmatch(r'[0-9]{1,12}', size), 'Invalid Drive size')
    size = int(size)
    require(0 < size <= maximum and (expected_size is None or size == expected_size),
            'Drive size disagrees with limits or manifest')
    if factory is None:
        from googleapiclient.http import MediaIoBaseDownload
        factory = MediaIoBaseDownload
    request = drive.files().get_media(fileId=item['id'])
    with path.open('xb') as target:
        path.chmod(0o600)
        fetcher = factory(target, request, chunksize=min(1024 * 1024, maximum))
        done = False
        while not done:
            _, done = fetcher.next_chunk()
            require(target.tell() <= size, 'Downloaded file exceeded its declared size')
        require(target.tell() == size, 'Downloaded file was truncated')


def preflight(drive, directory, name, fingerprint, factory=None):
    manifest_inputs(name, fingerprint)
    root = Path(directory)
    root.mkdir(mode=0o700, parents=False, exist_ok=False)
    items = list_backup_files(drive)
    require(name in items, 'Manifest is missing from the approved folder')
    manifest_path = root / 'manifest.json'
    download_file(drive, items[name], manifest_path, MAX_MANIFEST, factory=factory)
    manifest = load_manifest(manifest_path.read_bytes(), fingerprint)
    require(name == manifest['backup_set_id'] + '.manifest.json', 'Manifest set ID disagrees with filename')
    # Validate all required entries before downloading any encrypted archive.
    wanted = [entry['filename'] + suffix for entry in manifest['archives'].values()
              for suffix in ('', '.sha256')]
    require(all(filename in items for filename in wanted), 'Backup set is incomplete')
    for entry in manifest['archives'].values():
        filename = entry['filename']
        sidecar = root / (filename + '.sha256')
        download_file(drive, items[sidecar.name], sidecar, MAX_CHECKSUM, factory=factory)
        require(parse_checksum(sidecar.read_bytes(), filename) == entry['sha256'],
                'Checksum sidecar disagrees with pinned manifest')
        download_file(drive, items[filename], root / filename, MAX_ARCHIVE,
                      expected_size=entry['size_bytes'], factory=factory)
    return verify_local_set(manifest, root)


def main():
    root, name, fingerprint = check_guards()
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    sa = json.loads(os.environ['HUSTLE_RESTORE_DRIVE_SA_JSON'])
    require(sa.get('type') == 'service_account' and bool(sa.get('client_email')),
            'Expected a service-account reader')
    credentials = Credentials.from_service_account_info(
        sa, scopes=['https://www.googleapis.com/auth/drive.readonly'])
    drive = build('drive', 'v3', credentials=credentials, cache_discovery=False)
    preflight(drive, root, name, fingerprint)
    print('PASS: pinned manifest and all four encrypted archives/checksums verified.')
    print('SOURCE, CAPTURE CONSISTENCY AND COVERAGE: operator-declared only.')
    print('NOT TESTED: decryption, record counts, restore, original metadata/access, sign-in, full disaster recovery.')


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('STOP: encrypted backup-set preflight failed (private details withheld).', file=sys.stderr)
        sys.exit(1)
