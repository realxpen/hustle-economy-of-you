#!/usr/bin/env python3
"""Print a fixed error category, never private CLI output, paths or credentials."""
from pathlib import Path
import re
import sys


def classify_storage_error(text):
    patterns = (
        (r'unknown flag|unknown option|unrecognized (?:argument|option)', 'CLI_FLAG_UNSUPPORTED'),
        (r'mime type.*(?:not supported|not allowed|invalid)|unsupported.*(?:mime|content.type)', 'MIME_TYPE_REJECTED'),
        (r'exceeded.*(?:maximum|size)|payload too large|entity too large', 'FILE_SIZE_REJECTED'),
        (r'invalid (?:jwt|signature|api key)|jwt.*(?:expired|invalid)|unauthori[sz]ed|\b401\b', 'LOCAL_AUTH_REJECTED'),
        (r'row.level security|permission denied|access denied|\b403\b', 'LOCAL_ACCESS_DENIED'),
        (r'bucket.*(?:not found|does not exist)', 'LOCAL_BUCKET_MISSING'),
        (r'already exists|duplicate|\b409\b', 'LOCAL_OBJECT_EXISTS'),
        (r'connection refused|connect.*(?:timed out|timeout)|no such host', 'LOCAL_CONNECTION_FAILED'),
        (r'no such file or directory|file not found', 'LOCAL_FILE_MISSING'),
    )
    for pattern, category in patterns:
        if re.search(pattern, text, flags=re.IGNORECASE):
            return category
    return 'UNCLASSIFIED_STORAGE_ERROR'


def summary(text, operation):
    if operation not in ('upload', 'download'):
        raise ValueError('Unknown operation')
    return f'Local Storage {operation}: {classify_storage_error(text)} (private details withheld).'


if __name__ == '__main__':
    try:
        # Bound memory and suppress the raw exception if the private log is unreadable.
        with Path(sys.argv[1]).open('rb') as source:
            text = source.read(65_536).decode('utf-8', errors='replace')
        print(summary(text, sys.argv[2]), file=sys.stderr)
    except Exception:
        print('Local Storage: DIAGNOSTIC_UNAVAILABLE (private details withheld).', file=sys.stderr)
