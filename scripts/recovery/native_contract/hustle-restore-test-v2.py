#!/usr/bin/env python3
"""Test the verified October 20 Hustle native backup on a local Ubuntu Docker engine.

Run: python3 ~/Documents/hustle-restore-test-v2.py

Only the backup-encryption passphrase is requested, at a hidden local prompt.
No production database, Supabase API, environment file or network service is used.
The pinned public database image may be downloaded before the test. The helper
first rehearses generated fixtures, then restores the real backup into another
new container. All database/file data lives in that container's RAM-backed /tmp.
There are no host bind mounts, published ports or container networking. Cleanup
removes only this helper's UUID-labelled containers, including on ordinary errors.

This checks native SQL recovery, observed counts/migration-row counts, original
Storage metadata (except access bookkeeping) and actual recovered file bytes.
It does NOT start Auth/Storage APIs, test real sign-in or private-file access,
recover external configuration/Vault keys, reconcile migration equivalence, or
prove cross-service snapshot consistency. It does not authorize deployment.
"""

from __future__ import annotations

import argparse
import getpass
import gzip
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
from datetime import datetime, timezone
import uuid


SET_ID = "hustle-20261020T111134Z-9f73a014"
INVENTORY_SHA256 = "e7f947778dfd1879f95eacfc320e29f5067a88059e061292a870ae7b226371c4"
PROJECT = "pfgarmyygybmhiiuopym"
# Official multi-platform Supabase image digest, resolved 2026-10-20.
IMAGE = "docker.io/supabase/postgres:17.6.1.166@sha256:b3bfedb107413abb3b8cb0d0874b0414a1dceb3d55bc0c778de6ad22d1f7dc86"
ITERATIONS = 250000
LIMIT = 16 * 1024 * 1024
MAX_PLAINTEXT = 4 * 1024 * 1024 * 1024
SUFFIXES = ("-database.pgdump.enc", "-roles.sql.enc", "-catalog.json.gz.enc", "-storage_files.tar.gz.enc")
LABEL = "org.hustle.private-restore"
BOOTSTRAP_ROLE = "supabase_admin"  # Independently confirmed source role at OID 10.


class RestoreError(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message
        super().__init__(message)


def require(condition, code, message):
    if not condition:
        raise RestoreError(code, message)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def clean_environment():
    return {k: v for k, v in os.environ.items()
            if not k.upper().startswith(("PG", "SUPABASE", "POSTGRES"))
            and k.upper() not in ("DATABASE_URL", "DIRECT_URL", "DB_URL")}


def run(args, *, data=None, timeout=90, check=True):
    try:
        result = subprocess.run(args, input=data, capture_output=True, timeout=timeout,
                                env=clean_environment())
    except (OSError, subprocess.SubprocessError):
        raise RestoreError("LOCAL_COMMAND", "A local test command could not finish. No raw private output was printed.") from None
    if check:
        require(result.returncode == 0, "LOCAL_COMMAND", "A local test command failed. No raw private output was printed.")
    require(len(result.stdout) <= LIMIT and len(result.stderr) <= LIMIT,
            "OUTPUT_LIMIT", "A local command exceeded the private output limit.")
    return result


def private_write(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600)
    with os.fdopen(fd, "wb") as output:
        output.write(data)
        output.flush()
        os.fsync(output.fileno())


def plain_file(path, limit=MAX_PLAINTEXT):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == os.getuid(), "BACKUP_FILE", "Backup entries must be regular files owned by your user.")
    require(0 < info.st_size <= limit, "BACKUP_SIZE", "A backup entry has an unexpected size.")
    return info.st_size


def read_small(path):
    plain_file(path, LIMIT)
    return path.read_bytes()


def hash_file(path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_backup(folder):
    require(folder.is_dir() and not folder.is_symlink(), "BACKUP_FOLDER", "The completed October 20 backup folder was not found.")
    archives = {SET_ID + suffix for suffix in SUFFIXES}
    inventory_name = SET_ID + "-capture-inventory.json"
    expected = archives | {n + ".sha256" for n in archives} | {inventory_name, inventory_name + ".sha256", "READ_ME.txt"}
    require({p.name for p in folder.iterdir()} == expected, "BACKUP_INVENTORY", "The folder must contain exactly the original 11 completed backup files.")
    for name in expected:
        plain_file(folder / name)
    raw = read_small(folder / inventory_name)
    require(hashlib.sha256(raw).hexdigest() == INVENTORY_SHA256, "INVENTORY_HASH", "The inventory did not match the independently verified backup fingerprint.")
    try:
        inventory = json.loads(raw)
        require(inventory["format"] == "hustle-native-readonly-capture-v1" and
                inventory["backup_set_id"] == SET_ID and inventory["source_project_ref"] == PROJECT and
                inventory["capture_tool_version"] == "3", "BACKUP_IDENTITY", "The backup set identity was unexpected.")
        records = inventory["archives"]
        require(len(records) == 4 and {r["filename"] for r in records} == archives, "BACKUP_INVENTORY", "The inventory archive list was unexpected.")
        for record in records:
            path = folder / record["filename"]
            require(plain_file(path) == record["size_bytes"] and hash_file(path) == record["sha256"],
                    "ARCHIVE_HASH", "An encrypted backup file did not match its inventory.")
            require(read_small(folder / (path.name + ".sha256")) == (record["sha256"] + "  " + path.name + "\n").encode(),
                    "CHECKSUM_FILE", "An archive checksum file did not match.")
        require(read_small(folder / (inventory_name + ".sha256")) == (INVENTORY_SHA256 + "  " + inventory_name + "\n").encode(),
                "CHECKSUM_FILE", "The inventory checksum file did not match.")
    except RestoreError:
        raise
    except (KeyError, TypeError, ValueError):
        raise RestoreError("BACKUP_INVENTORY", "The backup inventory had an invalid structure.") from None
    return inventory


class Errors:
    def __init__(self, pipe):
        self.data = bytearray()
        def consume():
            with pipe:
                for chunk in iter(lambda: pipe.read(8192), b""):
                    if len(self.data) < LIMIT:
                        self.data.extend(chunk[:LIMIT - len(self.data)])
        self.thread = threading.Thread(target=consume, daemon=True)
        self.thread.start()

    def finish(self):
        self.thread.join(timeout=5)
        return bytes(self.data)


def cipher(path, password, decrypt=True):
    read_fd, write_fd = os.pipe()
    try:
        os.write(write_fd, password.encode() + b"\n")
    finally:
        os.close(write_fd)
    args = ["openssl", "enc"] + (["-d"] if decrypt else []) + ["-aes-256-cbc", "-salt", "-pbkdf2", "-md", "sha256", "-iter", str(ITERATIONS), "-pass", f"fd:{read_fd}"]
    args += ["-in" if decrypt else "-out", str(path)]
    try:
        process = subprocess.Popen(args, stdin=subprocess.DEVNULL if decrypt else subprocess.PIPE,
                                   stdout=subprocess.PIPE if decrypt else subprocess.DEVNULL,
                                   stderr=subprocess.PIPE, pass_fds=(read_fd,), env=clean_environment())
    finally:
        os.close(read_fd)
    return process, Errors(process.stderr)


def stop(process):
    if process.poll() is None:
        process.kill()
    process.wait(timeout=15)
    for pipe in (process.stdin, process.stdout):
        if pipe and not pipe.closed:
            try:
                pipe.close()
            except BrokenPipeError:
                pass


def watchdog(*processes):
    def kill():
        for process in processes:
            try:
                if process.poll() is None:
                    process.kill()
            except OSError:
                pass
    timer = threading.Timer(600, kill)
    timer.daemon = True
    timer.start()
    return timer


def decrypt_small(path, password):
    process, errors = cipher(path, password)
    try:
        raw = process.stdout.read(LIMIT + 1)
        require(len(raw) <= LIMIT, "DECRYPT_LIMIT", "A private metadata archive exceeded its limit.")
        code = process.wait(timeout=60)
        errors.finish()
        require(code == 0 and raw, "BACKUP_PASSPHRASE", "The backup could not be decrypted. Use only the separate backup-encryption passphrase.")
        return raw
    finally:
        stop(process)
        errors.finish()


def import_error(stage, private_error):
    # psql's sqlstate verbosity emits a code without the server's private message.
    # Only these anchored fields can leave the private stderr buffer.
    match = re.search(rb"(?m)^psql:<stdin>:([1-9][0-9]{0,6}): (?:ERROR|FATAL|PANIC):[ \t]+([0-9A-Z]{5})[ \t\r]*$", private_error)
    if match:
        line, state = (part.decode("ascii") for part in match.groups())
        return RestoreError(stage + "_" + state,
                            "The isolated import stopped at archive line " + line +
                            " (SQLSTATE " + state + "). No private SQL or error text was printed.")
    extension = b"extension" in private_error.lower() and b"not available" in private_error.lower()
    return RestoreError("RESTORE_EXTENSION" if extension else stage,
                        "The isolated import failed. No raw SQL or private error output was printed.")


def bootstrap_role_sql(raw):
    """Satisfy only the original bootstrap CREATE through initdb; retain all ALTER/GRANT.

    pg_dumpall emits CREATE even for the initial superuser. PostgreSQL 17 role
    grantors rely on that role retaining its bootstrap identity (OID 10). Mask
    literals/comments before locating the single redundant CREATE; a line inside
    a multiline role comment must never be edited. The ciphertext is unchanged.
    """
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise RestoreError("ROLE_SQL_FORMAT", "The roles archive was not the expected UTF-8 SQL.") from None
    masked = list(text)

    def hide(start, end):
        for position in range(start, end):
            if text[position] not in "\r\n":
                masked[position] = " "

    i = 0
    while i < len(text):
        start = i
        if text.startswith("--", i):
            end = text.find("\n", i + 2)
            i = len(text) if end < 0 else end
        elif text.startswith("/*", i):
            depth, i = 1, i + 2
            while i < len(text) and depth:
                if text.startswith("/*", i): depth, i = depth + 1, i + 2
                elif text.startswith("*/", i): depth, i = depth - 1, i + 2
                else: i += 1
            require(depth == 0, "ROLE_SQL_FORMAT", "An SQL comment was incomplete.")
        elif text[i] in "'\"":
            quote = text[i]
            escape = quote == "'" and i > 0 and text[i-1] in "Ee" and (i < 2 or not (text[i-2].isalnum() or text[i-2] in "_$"))
            i += 1
            while i < len(text):
                if escape and text[i] == "\\": i += 2
                elif text[i] == quote:
                    if i + 1 < len(text) and text[i+1] == quote: i += 2
                    else:
                        i += 1
                        break
                else: i += 1
            else:
                raise RestoreError("ROLE_SQL_FORMAT", "An SQL quoted value was incomplete.")
        elif text[i] == "$" and (tag := re.match(r"\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$", text[i:])):
            end = text.find(tag[0], i + len(tag[0]))
            require(end >= 0, "ROLE_SQL_FORMAT", "An SQL dollar-quoted value was incomplete.")
            i = end + len(tag[0])
        else:
            i += 1
            continue
        hide(start, i)
    code = "".join(masked)
    creates = list(re.finditer(r"(?m)^CREATE ROLE supabase_admin;\r?$", code))
    alters = list(re.finditer(r"(?m)^ALTER ROLE supabase_admin WITH ([^\r\n]*);\r?$", code))
    require(len(creates) == len(alters) == 1 and
            {"SUPERUSER", "LOGIN"} <= set(alters[0][1].split()) and
            (not code[:creates[0].start()].strip() or code[:creates[0].start()].rstrip().endswith(";")),
            "ROLE_BOOTSTRAP", "The roles archive did not match the confirmed source bootstrap-role contract.")
    match = creates[0]
    require(text[match.start():match.end()].rstrip("\r") == "CREATE ROLE supabase_admin;",
            "ROLE_BOOTSTRAP", "The initial role declaration was unexpected.")
    replacement = "-- Initial supabase_admin role created by initdb at its original bootstrap identity (OID 10)."
    if text[match.start():match.end()].endswith("\r"): replacement += "\r"
    return (text[:match.start()] + replacement + text[match.end():]).encode("utf-8")


def stream_restore(path, password, command, stage):
    source, errors = cipher(path, password)
    try:
        target = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL,
                                  stderr=subprocess.PIPE, env=clean_environment())
    except BaseException:
        stop(source)
        errors.finish()
        raise
    target_errors = Errors(target.stderr)
    timer = watchdog(source, target)
    total = 0
    try:
        for chunk in iter(lambda: source.stdout.read(1024 * 1024), b""):
            total += len(chunk)
            require(total <= MAX_PLAINTEXT, "DECRYPT_LIMIT", "A restored archive exceeded its limit.")
            target.stdin.write(chunk)
        target.stdin.close()
        source_code = source.wait(timeout=60)
        target_code = target.wait(timeout=60)
        errors.finish()
        private_error = target_errors.finish()
        require(source_code == 0 and total > 32, "BACKUP_PASSPHRASE", "An archive did not decrypt completely.")
        if target_code != 0:
            raise import_error(stage, private_error)
    except BrokenPipeError:
        stop(target)
        raise import_error(stage, target_errors.finish()) from None
    finally:
        timer.cancel()
        stop(source)
        stop(target)
        errors.finish()
        target_errors.finish()


CATALOG_SQL = '''BEGIN READ ONLY;
SELECT json_build_object(
 'observed_counts',json_build_object(
 'users',(SELECT count(*) FROM public."User"),
 'services',(SELECT count(*) FROM public."Service"),
 'bookings',(SELECT count(*) FROM public."Booking"),
 'notifications',(SELECT count(*) FROM public."Notification"),
 'auth_users',(SELECT count(*) FROM auth.users),
 'auth_identities',(SELECT count(*) FROM auth.identities),
 'prisma_migrations',(SELECT count(*) FROM public._prisma_migrations),
 'supabase_migrations',(SELECT count(*) FROM supabase_migrations.schema_migrations)),
 'buckets',coalesce((SELECT json_agg(to_jsonb(b) ORDER BY b.id) FROM storage.buckets b),'[]'::json),
 'objects',coalesce((SELECT json_agg(to_jsonb(o) ORDER BY o.bucket_id,o.name,o.id) FROM storage.objects o),'[]'::json)
); COMMIT;'''


def fingerprint(catalog):
    return canonical({"buckets": catalog["buckets"], "objects": [
        {k: v for k, v in obj.items() if k != "last_accessed_at"} for obj in catalog["objects"]]})


def compare_database(actual, reference):
    for expected in (reference["before"], reference["after"]):
        require(actual["observed_counts"] == expected["observed_counts"], "RESTORE_COUNTS", "Restored counts did not match both capture observations. No complete recovery result is reported.")
        require(fingerprint(actual) == fingerprint(expected), "RESTORE_METADATA", "Original Storage IDs, owners, settings or metadata did not match the capture reference.")


def read_reference(folder, password):
    try:
        raw = decrypt_small(folder / (SET_ID + "-catalog.json.gz.enc"), password)
        with gzip.GzipFile(fileobj=io.BytesIO(raw)) as stream:
            expanded = stream.read(LIMIT + 1)
        require(len(expanded) <= LIMIT, "CATALOG_LIMIT", "The private catalog exceeded its limit.")
        reference = json.loads(expanded)
        require(reference["source_project_ref"] == PROJECT and reference["cross_service_atomic"] is False,
                "CATALOG_IDENTITY", "The private capture reference had an unexpected identity.")
        records = reference["file_hashes"]
        require(isinstance(records, list) and len(records) <= 10000, "FILE_CATALOG", "The file catalog was invalid.")
        seen, objects = set(), {(x["bucket_id"], x["name"]): x for x in reference["before"]["objects"]}
        require(len(objects) == len(records), "FILE_CATALOG", "The file catalog did not cover every Storage object.")
        for record in records:
            key = (record["bucket_id"], record["name"])
            relative = "objects/" + hashlib.sha256((key[0] + "\0" + key[1]).encode()).hexdigest()
            require(key in objects and key not in seen and record["relative_path"] == relative and
                    record["object_id"] == objects[key]["id"] and record["version"] == objects[key].get("version") and
                    isinstance(record["size_bytes"], int) and 0 <= record["size_bytes"] <= 256 * 1024 * 1024 and
                    re.fullmatch(r"[0-9a-f]{64}", record["sha256"]) is not None,
                    "FILE_CATALOG", "A file reference, identity, size or digest was invalid.")
            seen.add(key)
        require(fingerprint(reference["before"]) == fingerprint(reference["after"]), "CAPTURE_CHANGED", "The before/after Storage references did not match.")
        return reference
    except RestoreError:
        raise
    except (KeyError, TypeError, ValueError, OSError, EOFError):
        raise RestoreError("PRIVATE_CATALOG", "The decrypted catalog could not be validated. No private content was printed.") from None


BOOT = '''set -eu
umask 077
mkdir -p /tmp/hustle/data /tmp/hustle/socket /tmp/hustle/files
initdb -D /tmp/hustle/data --username="$RESTORE_ADMIN" --auth=trust --encoding=UTF8 --locale=en_US.UTF-8 --locale-provider=icu --icu-locale=en-US >/dev/null 2>&1
exec postgres -D /tmp/hustle/data -k /tmp/hustle/socket \
 -c listen_addresses= -c unix_socket_permissions=0700 \
 -c timezone=UTC \
 -c shared_preload_libraries= -c shared_buffers=16MB -c max_connections=10 \
 -c max_wal_size=128MB -c logging_collector=off -c log_statement=none \
 -c log_min_messages=panic -c log_min_error_statement=panic
'''


class Database:
    def __init__(self):
        self.token = uuid.uuid4().hex
        self.name = "hustle-private-restore-" + self.token
        self.admin = BOOTSTRAP_ROLE
        self.created = False

    def command(self, program, args=(), input_stream=False):
        require(self.created, "TARGET_GUARD", "The owned test container is not ready.")
        base = ["docker", "exec"] + (["-i"] if input_stream else []) + ["--user", "postgres", self.name, program]
        if program in ("psql", "pg_dump", "pg_dumpall", "pg_restore"):
            base += ["--host=/tmp/hustle/socket", "--username=" + self.admin, "--no-password"]
        return base + list(args)

    def sql(self, sql):
        result = run(self.command("psql", ["--dbname=postgres", "-X", "-q", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", sql]))
        return result.stdout.strip()

    def start(self):
        args = ["docker", "run", "--detach", "--name", self.name, "--label", LABEL + "=" + self.token,
                "--network", "none", "--read-only", "--cap-drop=ALL", "--security-opt=no-new-privileges",
                "--user", "postgres", "--memory=768m", "--pids-limit=128", "--cpus=1", "--no-healthcheck",
                "--log-driver=none", "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=512m,mode=1777",
                "-e", "PGDATA=/tmp/hustle/data", "-e", "RESTORE_ADMIN=" + self.admin,
                "--entrypoint", "/bin/sh", IMAGE, "-c", BOOT]
        self.created = True  # Cleanup also covers a partially failed docker run.
        run(args)
        deadline = time.monotonic() + 60
        while time.monotonic() < deadline:
            result = run(self.command("psql", ["--dbname=postgres", "-X", "-qAt", "-c", "SELECT 1"]), timeout=10, check=False)
            if result.returncode == 0 and result.stdout.strip() == b"1":
                break
            state = run(["docker", "inspect", "--format", "{{.State.Running}}", self.name], check=False)
            require(state.stdout.strip() == b"true", "TARGET_START", "The temporary database could not start. No backup passphrase has been requested yet.")
            time.sleep(0.3)
        else:
            raise RestoreError("TARGET_START", "The temporary database was not ready within one minute.")
        self.guard()
        state = json.loads(self.sql("SELECT json_build_object('role',current_user,'bootstrap_oid',(SELECT oid::integer FROM pg_roles WHERE rolname=current_user),'database',current_database(),'version',current_setting('server_version_num'),'tables',(SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')),'vault',(SELECT count(*) FROM pg_available_extension_versions WHERE name='supabase_vault' AND version='0.3.1'));"))
        require(state["role"] == self.admin == BOOTSTRAP_ROLE and state["bootstrap_oid"] == 10 and state["database"] == "postgres" and int(state["version"]) // 10000 == 17 and state["tables"] == 0 and state["vault"] >= 1,
                "TARGET_EMPTY", "The target was not a new empty PostgreSQL 17 database with the required Vault extension.")

    def guard(self):
        obj = json.loads(run(["docker", "inspect", self.name]).stdout)[0]
        config, host = obj["Config"], obj["HostConfig"]
        require(config.get("Labels", {}).get(LABEL) == self.token and obj["Name"] == "/" + self.name and
                config["Image"] in (IMAGE, IMAGE.removeprefix("docker.io/")) and config["User"] == "postgres" and
                host["NetworkMode"] == "none" and host["ReadonlyRootfs"] and
                "ALL" in {x.upper() for x in host.get("CapDrop", [])} and not host.get("Privileged") and
                not host.get("Binds") and not host.get("PortBindings") and
                all(m.get("Type") == "tmpfs" and m.get("Destination") == "/tmp" for m in obj.get("Mounts", [])) and
                any(x.startswith("no-new-privileges") for x in host.get("SecurityOpt", [])) and
                "/tmp" in host.get("Tmpfs", {}) and host.get("LogConfig", {}).get("Type") == "none",
                "TARGET_ISOLATION", "The owned container did not meet the offline isolation requirements.")

    def catalog(self):
        return json.loads(self.sql(CATALOG_SQL))

    def restore(self, folder, password):
        self.guard()
        require(self.sql("SELECT count(*) FROM pg_roles WHERE oid=10 AND rolname='supabase_admin' AND rolsuper AND rolcanlogin;") == b"1",
                "ROLE_BOOTSTRAP", "The offline target did not preserve the confirmed source bootstrap identity.")
        role_sql = bootstrap_role_sql(decrypt_small(folder / (SET_ID + "-roles.sql.enc"), password))
        result = run(self.command("psql", ["--dbname=postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-v", "SHOW_CONTEXT=never", "--single-transaction", "-f", "-"], True),
                     data=role_sql, timeout=120, check=False)
        role_sql = b""
        if result.returncode != 0:
            raise import_error("RESTORE_ROLES", result.stderr)
        require(self.sql("SELECT count(*) FROM pg_roles WHERE rolname='postgres';") == b"1",
                "RESTORE_ROLES", "The roles import did not create the expected source role.")
        stream_restore(folder / (SET_ID + "-database.pgdump.enc"), password,
                       self.command("pg_restore", ["--dbname=postgres", "--exit-on-error", "--single-transaction"], True), "RESTORE_DATABASE")

    def cleanup(self):
        if not self.created:
            return
        result = run(["docker", "inspect", "--format", '{{json .Config.Labels}}', self.name], check=False)
        if result.returncode != 0:
            # Distinguish an absent container from an unavailable Docker engine.
            require(b"no such" in result.stderr.lower(), "CLEANUP", "The test container's absence could not be confirmed.")
            run(["docker", "info", "--format", "{{.ServerVersion}}"], timeout=15)
            self.created = False
            return
        require(json.loads(result.stdout).get(LABEL) == self.token, "CLEANUP_GUARD", "Cleanup refused a container without this test's exact ownership label.")
        run(["docker", "rm", "--force", "--volumes", self.name], timeout=30)
        result = run(["docker", "inspect", self.name], check=False)
        require(result.returncode != 0, "CLEANUP", "A temporary test container was still present after cleanup.")
        self.created = False


def restore_files(database, archive, password, reference):
    records = reference["file_hashes"]
    wanted = {r["relative_path"]: r for r in records}
    require(len(wanted) == len(records), "FILE_CATALOG", "Duplicate file references were found.")
    source, errors = cipher(archive, password)
    try:
        target = subprocess.Popen(database.command("tar", ["-x", "-o", "-f", "-", "-C", "/tmp/hustle/files"], True),
                                  stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, env=clean_environment())
    except BaseException:
        stop(source)
        errors.finish()
        raise
    target_errors = Errors(target.stderr)
    timer = watchdog(source, target)
    seen, manifest, catalog = set(), None, None
    try:
        with tarfile.open(fileobj=source.stdout, mode="r|gz") as incoming, tarfile.open(fileobj=target.stdin, mode="w|") as outgoing:
            for member in incoming:
                require(member.isfile() and member.name not in seen, "FILE_ARCHIVE", "The file archive had an unexpected type or duplicate member.")
                seen.add(member.name)
                with incoming.extractfile(member) as content:
                    if member.name in wanted:
                        record = wanted[member.name]
                        require(member.size == record["size_bytes"] and re.fullmatch(r"objects/[0-9a-f]{64}", member.name), "FILE_ARCHIVE", "An archived file had an invalid path or length.")
                        info = tarfile.TarInfo(member.name)
                        info.size, info.mode = member.size, 0o600
                        outgoing.addfile(info, content)  # Repack regular, validated paths only.
                    elif member.name in ("file-hashes.json", "storage-catalog.json"):
                        require(member.size <= LIMIT, "FILE_ARCHIVE", "The file metadata exceeded its limit.")
                        item = json.loads(content.read(LIMIT + 1))
                        if member.name == "file-hashes.json": manifest = item
                        else: catalog = item
                    else:
                        raise RestoreError("FILE_ARCHIVE", "The file archive contained an unexpected member.")
        target.stdin.close()
        while source.stdout.read(1024 * 1024):
            pass
        require(source.wait(timeout=60) == 0 and target.wait(timeout=60) == 0, "FILE_RESTORE", "The isolated file recovery did not finish.")
        require(seen == set(wanted) | {"file-hashes.json", "storage-catalog.json"} and
                manifest == {"source_project_ref": PROJECT, "files": records} and
                catalog == {"buckets": reference["before"]["buckets"], "objects": reference["before"]["objects"]},
                "FILE_ARCHIVE", "Recovered file references did not match the encrypted catalog.")
        raw = run(database.command("/bin/sh", ["-c", "cd /tmp/hustle/files; if [ -d objects ]; then find objects -type f -exec sha256sum '{}' +; fi"])).stdout.decode()
        actual = {}
        for line in raw.splitlines():
            match = re.fullmatch(r"([0-9a-f]{64})  (objects/[0-9a-f]{64})", line)
            require(match is not None and match[2] not in actual, "FILE_READBACK", "The recovered file readback was invalid.")
            actual[match[2]] = match[1]
        require(actual == {path: r["sha256"] for path, r in wanted.items()}, "FILE_READBACK", "A recovered file did not match its captured bytes.")
        return len(actual)
    finally:
        timer.cancel()
        stop(source)
        stop(target)
        errors.finish()
        target_errors.finish()


FIXTURE_SQL = '''
CREATE ROLE hustle_fixture_owner NOLOGIN;
CREATE ROLE hustle_fixture_reader NOLOGIN;
CREATE ROLE postgres NOLOGIN;
GRANT hustle_fixture_reader TO postgres WITH INHERIT FALSE GRANTED BY supabase_admin;
GRANT pg_monitor TO postgres WITH ADMIN OPTION GRANTED BY supabase_admin;
CREATE SCHEMA extensions;
CREATE SCHEMA vault;
CREATE EXTENSION supabase_vault WITH SCHEMA vault;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE SCHEMA auth; CREATE SCHEMA storage; CREATE SCHEMA supabase_migrations;
CREATE TABLE public."User"(id uuid PRIMARY KEY);
CREATE TABLE public."Service"(id integer PRIMARY KEY);
CREATE TABLE public."Booking"(id integer PRIMARY KEY);
CREATE TABLE public."Notification"(id integer PRIMARY KEY);
CREATE TABLE public._prisma_migrations(id text PRIMARY KEY);
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE auth.identities(id uuid PRIMARY KEY,user_id uuid REFERENCES auth.users);
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,created_at timestamptz);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text REFERENCES storage.buckets,name text,owner_id text,version text,metadata jsonb,created_at timestamptz,last_accessed_at timestamptz);
INSERT INTO public."User" VALUES('00000000-0000-4000-8000-000000000001');
INSERT INTO public."Service" VALUES(1); INSERT INTO public."Booking" VALUES(1);
INSERT INTO public."Notification" VALUES(1); INSERT INTO public._prisma_migrations VALUES('fixture-ledger');
INSERT INTO auth.users SELECT id FROM public."User";
INSERT INTO auth.identities VALUES('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001');
INSERT INTO supabase_migrations.schema_migrations VALUES('fixture-ledger');
INSERT INTO storage.buckets VALUES('fixture','fixture',false,'2026-01-01T00:00:00Z');
INSERT INTO storage.objects VALUES('00000000-0000-4000-8000-000000000003','fixture','nested/proof.txt','00000000-0000-4000-8000-000000000001','fixture-version','{"size":20}','2026-01-01T00:00:00Z',NULL);
ALTER TABLE storage.objects OWNER TO hustle_fixture_owner;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO hustle_fixture_reader;
GRANT SELECT ON storage.objects TO hustle_fixture_reader;
CREATE POLICY fixture_owner_access ON storage.objects FOR SELECT TO hustle_fixture_reader
USING(owner_id=current_setting('hustle.fixture_actor',true));
'''


def synthetic_contract():
    databases = []
    password = "generated-fixture-passphrase-only"
    try:
        source, target = Database(), Database()
        databases.extend((source, target))
        source.start()
        source.sql(FIXTURE_SQL)
        # Negative control: SUPERUSER alone cannot replace the bootstrap grantor.
        probe = run(source.command("psql", ["--dbname=postgres", "-X", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-v", "SHOW_CONTEXT=never", "-f", "-"], True),
                    data=b"BEGIN;\nCREATE ROLE hustle_fixture_wrong_grantor SUPERUSER NOLOGIN;\nGRANT hustle_fixture_reader TO postgres GRANTED BY hustle_fixture_wrong_grantor;\nCOMMIT;\n", check=False)
        require(probe.returncode == 3 and import_error("FIXTURE", probe.stderr).code == "FIXTURE_42501" and
                source.sql("SELECT count(*) FROM pg_roles WHERE rolname='hustle_fixture_wrong_grantor';") == b"0",
                "FIXTURE_GRANTOR", "The generated bootstrap-grantor regression check did not behave as expected.")
        reference = {"before": source.catalog()}
        reference["after"] = reference["before"]
        payload = b"Hustle fixture bytes"
        require(len(payload) == 20, "FIXTURE", "Invalid internal file fixture.")
        obj = reference["before"]["objects"][0]
        relative = "objects/" + hashlib.sha256((obj["bucket_id"] + "\0" + obj["name"]).encode()).hexdigest()
        reference["file_hashes"] = [{"bucket_id": obj["bucket_id"], "name": obj["name"], "object_id": obj["id"], "version": obj["version"], "relative_path": relative, "size_bytes": len(payload), "sha256": hashlib.sha256(payload).hexdigest()}]
        with tempfile.TemporaryDirectory(prefix="hustle-generated-restore-fixtures-") as directory:
            folder = Path(directory)
            for suffix, command in (("-roles.sql.enc", source.command("pg_dumpall", ["--roles-only", "--no-role-passwords", "--database=postgres"])),
                                    ("-database.pgdump.enc", source.command("pg_dump", ["--dbname=postgres", "--format=custom", "--quote-all-identifiers", "--no-subscriptions"]))):
                encrypt_fixture(folder / (SET_ID + suffix), password, command=command)
            data = io.BytesIO()
            with tarfile.open(fileobj=data, mode="w:gz") as archive:
                for name, content in ((relative, payload), ("file-hashes.json", canonical({"source_project_ref": PROJECT, "files": reference["file_hashes"]})),
                                      ("storage-catalog.json", canonical({"buckets": reference["before"]["buckets"], "objects": reference["before"]["objects"]}))):
                    info = tarfile.TarInfo(name)
                    info.size = len(content)
                    archive.addfile(info, io.BytesIO(content))
            files = folder / (SET_ID + "-storage_files.tar.gz.enc")
            encrypt_fixture(files, password, data=data.getvalue())
            target.start()
            target.restore(folder, password)
            require(target.sql("SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member JOIN pg_roles g ON g.oid=m.grantor WHERE u.rolname='postgres' AND g.oid=10 AND g.rolname='supabase_admin' AND ((r.rolname='hustle_fixture_reader' AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option) OR (r.rolname='pg_monitor' AND m.admin_option AND m.inherit_option AND m.set_option));") == b"2",
                    "FIXTURE_GRANTOR", "Original role grantors or membership options did not survive recovery.")
            compare_database(target.catalog(), reference)
            require(restore_files(target, files, password, reference) == 1, "FIXTURE", "The generated file did not survive recovery.")
            visible = target.sql("BEGIN READ ONLY; SET LOCAL ROLE hustle_fixture_reader; SET LOCAL hustle.fixture_actor='00000000-0000-4000-8000-000000000001'; SELECT count(*) FROM storage.objects; COMMIT;")
            hidden = target.sql("BEGIN READ ONLY; SET LOCAL ROLE hustle_fixture_reader; SET LOCAL hustle.fixture_actor='00000000-0000-4000-8000-000000000099'; SELECT count(*) FROM storage.objects; COMMIT;")
            require(visible == b"1" and hidden == b"0", "FIXTURE_POLICY", "The generated owner/other-user policy contract did not survive recovery.")
    finally:
        cleanup_all(databases)


def encrypt_fixture(path, password, *, command=None, data=None):
    target, errors = cipher(path, password, decrypt=False)
    source = None
    source_errors = None
    timer = watchdog(target)
    source_timer = None
    try:
        if command:
            source = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, env=clean_environment())
            source_errors = Errors(source.stderr)
            source_timer = watchdog(source)
            for chunk in iter(lambda: source.stdout.read(1024 * 1024), b""):
                target.stdin.write(chunk)
            require(source.wait(timeout=60) == 0, "FIXTURE_CAPTURE", "The generated database fixture could not be captured.")
        else:
            target.stdin.write(data)
        target.stdin.close()
        require(target.wait(timeout=60) == 0, "FIXTURE_CAPTURE", "The generated fixture could not be encrypted.")
    finally:
        timer.cancel()
        if source_timer: source_timer.cancel()
        if source: stop(source)
        stop(target)
        errors.finish()
        if source_errors: source_errors.finish()


def cleanup_all(databases):
    failures = []
    for database in reversed(databases):
        try:
            database.cleanup()
        except Exception:
            failures.append(database.name)
    require(not failures, "CLEANUP", "Remove only these leftover test containers with docker rm --force --volumes: " + " ".join(failures))


def preflight():
    require(sys.platform == "linux" and os.getuid() != 0, "LOCAL_USER", "Run this as your normal Ubuntu user, without sudo.")
    require(sys.stdin.isatty(), "PRIVATE_TERMINAL", "Use your own interactive Terminal.")
    for name in ("docker", "openssl"):
        require(shutil.which(name), "SOFTWARE", name + " is not installed.")
    host = os.environ.get("DOCKER_HOST", "")
    require(not host or host.startswith("unix:///"), "LOCAL_DOCKER", "Use a local Docker socket; remote Docker engines are not accepted.")
    context = run(["docker", "context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"])
    require(json.loads(context.stdout).startswith("unix:///"), "LOCAL_DOCKER", "Use a local Docker socket.")
    run(["docker", "info", "--format", "{{.ServerVersion}}"])
    print("Preparing the pinned Supabase PostgreSQL 17 image (about 370 MB on first use)...", flush=True)
    if run(["docker", "image", "inspect", IMAGE], check=False).returncode:
        run(["docker", "pull", IMAGE], timeout=900)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--self-test", action="store_true", help="Run generated recovery fixtures only; no private backup or passphrase.")
    args = parser.parse_args()
    print("Hustle restore test v2 - source bootstrap-role identity preserved.", flush=True)
    os.umask(0o077)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    databases = []
    try:
        folder = Path.home() / "Hustle-Private-Backups" / SET_ID
        if not args.self_test:
            print("[1/6] Checking the exact verified backup files...", flush=True)
            verify_backup(folder)
        preflight()
        print("[2/6] Rehearsing generated roles, native database, private-file metadata, file bytes and owner/other-user policy...", flush=True)
        synthetic_contract()
        print("Generated recovery contract passed; fixture containers removed.", flush=True)
        if args.self_test:
            print("SELF-TEST PASSED. No private backup was opened.")
            return 0
        target = Database()
        databases.append(target)
        target.start()
        password = getpass.getpass("Backup-encryption passphrase only (typing hidden): ")
        require(16 <= len(password) and len(password.encode()) <= 1024 and not any(c in password for c in "\r\n\0"), "BACKUP_PASSPHRASE", "Use the separate passphrase chosen during the October 20 backup.")
        reference = read_reference(folder, password)
        print("[3/6] Restoring roles and the native database into the new offline target...", flush=True)
        target.restore(folder, password)
        print("[4/6] Comparing database counts, migration-row counts and original Storage metadata...", flush=True)
        actual = target.catalog()
        compare_database(actual, reference)
        print("[5/6] Recovering file bytes into temporary storage and hashing every recovered file...", flush=True)
        count = restore_files(target, folder / (SET_ID + "-storage_files.tar.gz.enc"), password, reference)
        password = ""
        print("[6/6] Removing the temporary database and recovered files...", flush=True)
        cleanup_all(databases)
        root = Path.home() / "Hustle-Restore-Checks"
        require(not root.is_symlink(), "REPORT_FOLDER", "The report folder must not be a symbolic link.")
        root.mkdir(mode=0o700, exist_ok=True)
        require(root.stat().st_uid == os.getuid(), "REPORT_FOLDER", "The report folder must belong to your current user.")
        root.chmod(0o700)
        report = {"format": "hustle-local-native-restore-check-v1", "restore_tool_version": "2", "backup_set_id": SET_ID,
                  "inventory_sha256": INVENTORY_SHA256, "test_image": IMAGE,
                  "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                  "synthetic_contract_passed": True, "native_database_and_roles_imported_without_ignored_errors": True,
                  "source_bootstrap_role_preserved": BOOTSTRAP_ROLE,
                  "bootstrap_role_create_satisfied_by_initdb": True,
                  "restored_counts": actual["observed_counts"], "storage_metadata_matches_ignoring_access_bookkeeping": True,
                  "files_recovered_and_rehashed": count, "temporary_containers_removed": True,
                  "production_accessed": False, "auth_signin_tested": False, "storage_api_access_tested": False,
                  "external_configuration_recovered": False, "cross_service_atomic": False, "full_disaster_recovery_verified": False}
        output = root / (SET_ID + "-restore-" + uuid.uuid4().hex[:8] + ".json")
        raw = json.dumps(report, indent=2).encode() + b"\n"
        private_write(output, raw)
        print("\nLOCAL DATABASE AND FILE RESTORE CHECK PASSED.")
        print("Recovered file bytes verified: " + str(count))
        print("Temporary database and recovered files removed.")
        print("Report: " + str(output))
        print("Report SHA256: " + hashlib.sha256(raw).hexdigest())
        print("Real Auth sign-in, Storage API permissions and full disaster recovery remain unverified.")
        return 0
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Test stopped. No complete recovery result is reported.", file=sys.stderr)
        return 130
    except RestoreError as error:
        print(f"\n[{error.code}] {error.message}", file=sys.stderr)
        return 1
    except Exception as error:
        print("\n[LOCAL_RESTORE_ERROR] Test stopped (" + type(error).__name__ + "). No private diagnostics were printed. Share only this code.", file=sys.stderr)
        return 1
    finally:
        try:
            cleanup_all(databases)
        except RestoreError as error:
            print(f"\n[{error.code}] {error.message}", file=sys.stderr)
            # Cleanup failures must never be reported as a passing run.
            return 1


if __name__ == "__main__":
    sys.exit(main())
