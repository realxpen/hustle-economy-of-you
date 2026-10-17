#!/usr/bin/env python3
"""Verify encrypted Storage metadata COPY counts without writing to live Supabase.

This is not a restore of original Storage object UUIDs, owner data or policies.
"""
import gzip
import os
from pathlib import Path
import subprocess
import sys

NAME='hustle-storage-metadata-20261016T094534Z.sql.gz.enc'


def copy_count(sql, table):
    start=f'COPY storage.{table} ('
    rows=0; copies=0; in_block=False
    for line in sql.splitlines():
        if line.startswith(start):
            if in_block: raise ValueError('Nested metadata copy')
            in_block=True; copies+=1
        elif in_block and line==r'\.':
            in_block=False
        elif in_block:
            rows+=1
    if in_block or copies != 1:
        raise ValueError('Missing complete metadata COPY section')
    return rows


def run():
    if os.getenv('GITHUB_ACTIONS')!='true' or os.getenv('HUSTLE_ISOLATED_RECOVERY')!='true':
        raise ValueError('Cloud recovery guard missing')
    if os.getenv('DATABASE_URL') or os.getenv('SUPABASE_ACCESS_TOKEN'):
        raise ValueError('Unexpected production credential')
    root=Path(os.environ['RUNNER_TEMP'])/'hustle-encrypted-downloads'
    result=subprocess.run(['openssl','enc','-d','-aes-256-cbc','-pbkdf2','-iter','250000',
        '-pass','env:HUSTLE_RESTORE_METADATA_PASSPHRASE','-in',str(root/NAME)],
        capture_output=True)
    if result.returncode: raise ValueError('Metadata decryption failed')
    text=gzip.decompress(result.stdout).decode('utf-8')
    if (copy_count(text,'buckets'),copy_count(text,'objects'))!=(4,10):
        raise ValueError('Metadata record counts differ')
    print('PASS: earlier 09:45 Storage metadata reference decrypted (4 buckets; 10 object rows).')
    print('GAP: Original Storage UUIDs, owner metadata, timestamps and RLS are not restored by this smoke test.')
    print('GAP: Real login, sessions and MFA were not tested.')


if __name__=='__main__':
    try: run()
    except Exception:
        print('STOP: metadata verification failed; private content suppressed.',file=sys.stderr)
        sys.exit(1)
