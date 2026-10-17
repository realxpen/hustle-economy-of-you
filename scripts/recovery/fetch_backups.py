#!/usr/bin/env python3
"""Download exact Hustle encrypted archives from a private Drive folder.

The owner must grant one dedicated service account reader access and store its
JSON key as a GitHub *environment* secret; no backup is ever downloaded on a PR.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import sys

FOLDER = '1iCRbvOV07FYu3SvrXY4u6O9SAXNhUXWp'
ARCHIVES = [
    'hustle-appdb-20261016T115915Z.tar.gz.enc',
    'hustle-auth-20261016T120049Z.sql.gz.enc',
    'hustle-storage-metadata-20261016T094534Z.sql.gz.enc',
    'hustle-storage-20261016T121815Z.tar.gz.enc',
]


def parse_checksum(data, expected_filename):
    m = re.fullmatch(r'([a-fA-F0-9]{64})  ([^\r\n]+)\r?\n?', data.decode('ascii'))
    if not m or m.group(2) != expected_filename:
        raise ValueError('Checksum does not match the exact approved filename')
    return m.group(1).lower()


def check_guards():
    if os.getenv('GITHUB_ACTIONS') != 'true' or os.getenv('HUSTLE_ISOLATED_RECOVERY') != 'true':
        raise ValueError('Not the authorized ephemeral recovery job')
    if os.getenv('DATABASE_URL') or os.getenv('SUPABASE_ACCESS_TOKEN'):
        raise ValueError('Unexpected production-capable environment variable')
    if os.getenv('HUSTLE_BACKUP_FOLDER_ID') != FOLDER:
        raise ValueError('Unexpected Drive folder')
    if not os.getenv('HUSTLE_RESTORE_DRIVE_SA_JSON'):
        raise ValueError('Missing dedicated Drive reader secret')
    for suffix in ('APP', 'AUTH', 'STORAGE', 'METADATA'):
        if not os.getenv('HUSTLE_RESTORE_' + suffix + '_PASSPHRASE'):
            raise ValueError('Missing one or more encrypted archive passphrases')
    root = Path(os.environ['RUNNER_TEMP'])
    if not root.is_absolute() or str(root) in ('/', '/tmp'):
        raise ValueError('Unsafe runner temporary directory')
    return root / 'hustle-encrypted-downloads'


def fetch():
    from google.oauth2.service_account import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    root = check_guards()
    root.mkdir(mode=0o700, parents=True, exist_ok=True)
    sa = json.loads(os.environ['HUSTLE_RESTORE_DRIVE_SA_JSON'])
    if sa.get('type') != 'service_account' or not sa.get('client_email'):
        raise ValueError('Expected a service-account reader identity')
    credentials = Credentials.from_service_account_info(
        sa, scopes=['https://www.googleapis.com/auth/drive.readonly'])
    drive = build('drive', 'v3', credentials=credentials, cache_discovery=False)
    items = {}
    token = None
    while True:
        page = drive.files().list(q=f"'{FOLDER}' in parents and trashed = false",
                                  fields='nextPageToken,files(id,name,mimeType,size)',
                                  page_size=100, page_token=token).execute()
        for item in page.get('files', []):
            if item['name'] in items:
                raise ValueError('Duplicate file name in Drive backup folder')
            items[item['name']] = item
        token = page.get('nextPageToken')
        if not token:
            break
    wanted = [name + ext for name in ARCHIVES for ext in ('', '.sha256')]
    missing = [name for name in wanted if name not in items]
    if missing:
        raise ValueError('Missing required October 16 backup: ' + ', '.join(missing))
    print('Preflight passed: all eight EXACT October 16 backup files exist in Drive.')
    for name in wanted:
        item = items[name]
        if item['mimeType'].startswith('application/vnd.google-apps.'):
            raise ValueError('Expected raw encrypted binary, not converted Drive file')
        request = drive.files().get_media(fileId=item['id'])
        with (root / name).open('xb') as out:
            fetcher = MediaIoBaseDownload(out, request, chunksize=1024*1024)
            done = False
            while not done:
                _, done = fetcher.next_chunk()
        (root / name).chmod(0o600)
    for name in ARCHIVES:
        digest = parse_checksum((root / (name + '.sha256')).read_bytes(), name)
        with (root / name).open('rb') as f:
            actual = hashlib.file_digest(f, 'sha256').hexdigest()
        if actual != digest:
            raise ValueError('Encrypted archive SHA-256 mismatch')
    print('PASS: four encrypted archives and all matching SHA-256 checksums.')


if __name__ == '__main__':
    try:
        fetch()
    except Exception as e:
        # Only enumerate missing *approved* filenames, never auth errors/secret data.
        reason = str(e)
        if not (reason.startswith('Missing required October 16 backup:') or
                reason.startswith('Missing one or more') or
                reason.startswith('Missing dedicated') or
                reason.startswith('Preflight')):
            reason = 'Private Drive access, environment guard or integrity validation failed'
        print('STOP: ' + reason, file=sys.stderr)
        sys.exit(1)
