#!/usr/bin/env python3
"""Safely unpack a gzip-compressed tar stream from stdin into a private folder.

Reject all symlinks, hardlinks, devices, traversal paths and duplicate names.
Used ONLY after the exact encrypted archive checksum has been verified.
"""
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile


def extract(stream, dest):
    dest = Path(dest)
    if not dest.is_dir() or dest.is_symlink():
        raise ValueError('Destination must already be a real directory')
    dest = dest.resolve()
    seen = set()
    with tarfile.open(fileobj=stream, mode='r|gz') as tar:
        for member in tar:
            name = member.name
            p = PurePosixPath(name)
            if p.is_absolute() or '..' in p.parts or '\\' in name:
                raise ValueError('Unsafe archive path')
            parts = [x for x in p.parts if x not in ('.', '')]
            if not parts and member.isdir():
                continue
            if not parts or not (member.isdir() or member.isfile()):
                raise ValueError('Unsafe archive member type')
            normalized = '/'.join(parts)
            if normalized in seen:
                raise ValueError('Duplicate archive member')
            seen.add(normalized)
            if member.size > 100_000_000:
                raise ValueError('Oversized archive member')
            target = dest.joinpath(*parts)
            if not target.resolve().is_relative_to(dest):
                raise ValueError('Archive target escapes destination')
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True, mode=0o700)
            else:
                target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
                with tar.extractfile(member) as inp, target.open('xb') as out:
                    shutil.copyfileobj(inp, out)
                target.chmod(0o600)


if __name__ == '__main__':
    try:
        if len(sys.argv) != 2:
            raise ValueError('Expected one extraction path')
        extract(sys.stdin.buffer, sys.argv[1])
    except Exception:
        print('STOP: archive extraction failed; no private paths printed.', file=sys.stderr)
        sys.exit(1)
