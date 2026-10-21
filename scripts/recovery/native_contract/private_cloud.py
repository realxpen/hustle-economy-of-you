#!/usr/bin/env python3
"""Rehearse the exact private native backup in a protected main-only CI job.

No credential arguments, terminal prompts, production connection or mutations.
Only encrypted files and the previously verified report are downloaded. Native
plaintext recovery stays in owned network-disabled containers' RAM-backed /tmp.
"""

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import logging
import os
from pathlib import Path
import re
import signal
import sys
import tempfile
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import build_opener, HTTPRedirectHandler, Request

spec = importlib.util.spec_from_file_location("hustle_generated_cloud", Path(__file__).with_name("cloud_contract.py"))
cloud = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cloud)
access, core = cloud.access, cloud.core

FOLDER = "1cl7YwCgjfgLu39ekaKT7zT3RDGheYXju"
TOKEN_URL = "https://oauth2.googleapis.com/token"
DRIVE_BASE = "https://www.googleapis.com/drive/v3/files"
SCOPE = "https://www.googleapis.com/auth/drive.readonly"
WORKFLOW = "realxpen/hustle-economy-of-you/.github/workflows/hustle-native-backup-access.yml@refs/heads/main"
CONFIRM = "VERIFY_NATIVE_BACKUP"
SECRET_NAMES = ("HUSTLE_RESTORE_DRIVE_SA_JSON", "HUSTLE_NATIVE_BACKUP_PASSPHRASE",
                "HUSTLE_RECOVERY_OWNER_EMAIL", "HUSTLE_RECOVERY_OWNER_PASSWORD")
MAX_DOWNLOAD = 32 * 1024 * 1024
ARCHIVE_SIZES = dict(zip(core.SUFFIXES, (726784, 6208, 4032, 19593488)))


@dataclass(repr=False)
class Inputs:
    service_account: str
    backup_passphrase: str
    owner_email: str
    owner_password: str


def take_inputs():
    # Remove every private input before any subprocess, library refresh or Docker
    # invocation. No private recovery credential reaches children via inheritance.
    values = [os.environ.pop(name, "") for name in SECRET_NAMES]
    core.require(all(values), "NATIVE_SECRET_SETUP", "Add the three native backup/account secrets to the protected recovery environment; retain its existing Drive reader secret.")
    result = Inputs(*values)
    core.require(16 <= len(result.backup_passphrase) <= 1024 and len(result.backup_passphrase.encode()) <= 1024
                 and not any(x in result.backup_passphrase for x in "\r\n\0"),
                 "NATIVE_PASSPHRASE", "Use the existing October 20 backup-encryption passphrase.")
    result.owner_email = result.owner_email.strip()
    core.require(3 <= len(result.owner_email) <= 320 and "@" in result.owner_email
                 and not any(x in result.owner_email for x in "\r\n\0")
                 and 1 <= len(result.owner_password) <= 1024 and "\0" not in result.owner_password,
                 "NATIVE_ACCOUNT", "Use the consenting proof-owner account's email and password at capture time.")
    return result


def guard():
    core.require(os.environ.get("GITHUB_WORKFLOW_REF") == WORKFLOW
                 and os.environ.get("GITHUB_REF") == "refs/heads/main"
                 and os.environ.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
                 and os.environ.get("GITHUB_JOB") == "private-access"
                 and not os.environ.get("GITHUB_HEAD_REF")
                 and os.environ.get("HUSTLE_NATIVE_CONFIRM") == CONFIRM
                 and os.environ.get("HUSTLE_GENERATED_GATE") == "passed",
                 "NATIVE_JOB_GUARD", "Private recovery requires the protected main-only workflow after its generated gate.")
    expected = os.environ.get("GITHUB_SHA", "")
    core.require(bool(re.fullmatch(r"[0-9a-f]{40}", expected)), "NATIVE_REVISION", "The workflow revision was invalid.")
    core.require(core.run(["git", "rev-parse", "HEAD"]).stdout.strip().decode() == expected,
                 "NATIVE_REVISION", "The checkout does not match the selected main workflow revision.")
    root = Path(os.environ.get("RUNNER_TEMP", ""))
    core.require(root.is_absolute() and str(root) not in ("/", "/tmp") and root.is_dir()
                 and not root.is_symlink() and root.stat().st_uid == os.getuid(),
                 "NATIVE_TEMP", "The owned runner temporary directory was invalid.")
    cloud.preflight()  # Hosted runner, local socket, no production env, pinned images.
    cloud.assert_clean()
    return root


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise core.RestoreError("DRIVE_REDIRECT", "The Drive request redirected; no authorization was forwarded.")


class OAuthResponse:
    def __init__(self, status, data, headers):
        self.status, self.data, self.headers = status, data, headers


class Drive:
    def __init__(self, raw):
        from google.oauth2.service_account import Credentials
        try:
            info = json.loads(raw)
            core.require(info.get("type") == "service_account" and info.get("token_uri") == TOKEN_URL
                         and info.get("universe_domain", "googleapis.com") == "googleapis.com"
                         and re.fullmatch(r"[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com", info.get("client_email", "")),
                         "DRIVE_IDENTITY", "Use the existing dedicated Google Drive reader service-account secret.")
            self.opener = build_opener(NoRedirect())
            self.credentials = Credentials.from_service_account_info(info, scopes=[SCOPE])
            self.credentials.refresh(self.oauth_request)
            core.require(bool(self.credentials.token), "DRIVE_TOKEN", "The dedicated reader could not authenticate.")
        except core.RestoreError:
            raise
        except Exception:
            raise core.RestoreError("DRIVE_AUTH", "The Drive reader could not authenticate; no private diagnostic was printed.") from None

    def oauth_request(self, url, method="GET", body=None, headers=None, timeout=None, **_kwargs):
        core.require(url == TOKEN_URL and method == "POST", "DRIVE_TOKEN_ENDPOINT", "The credential refresh target was not Google's fixed token endpoint.")
        request = Request(url, data=body, headers=headers or {}, method=method)
        try:
            with self.opener.open(request, timeout=30) as response:
                data = response.read(1024 * 1024 + 1)
                core.require(len(data) <= 1024 * 1024, "DRIVE_RESPONSE", "The token response exceeded its bound.")
                return OAuthResponse(response.status, data, dict(response.headers))
        except core.RestoreError:
            raise
        except Exception:
            raise core.RestoreError("DRIVE_AUTH", "The Drive reader token request failed; no private response was printed.") from None

    def open(self, url):
        parsed = urlsplit(url)
        core.require(parsed.scheme == "https" and parsed.netloc == "www.googleapis.com"
                     and parsed.path.startswith("/drive/v3/files") and not parsed.fragment,
                     "DRIVE_ENDPOINT", "Only the fixed Drive files API is allowed.")
        request = Request(url, headers={"Authorization": "Bearer " + self.credentials.token}, method="GET")
        try:
            return self.opener.open(request, timeout=60)
        except core.RestoreError:
            raise
        except HTTPError as error:
            error.close()
            raise core.RestoreError("DRIVE_READ", "The dedicated reader could not read the selected backup; check its existing folder access.") from None
        except Exception:
            raise core.RestoreError("DRIVE_READ", "The selected Drive file could not be read; no raw response was printed.") from None

    def json(self, path="", **params):
        with self.open(DRIVE_BASE + path + "?" + urlencode(params)) as response:
            raw = response.read(1024 * 1024 + 1)
        core.require(len(raw) <= 1024 * 1024, "DRIVE_RESPONSE", "The Drive metadata response exceeded its bound.")
        return json.loads(raw)

    def list_files(self):
        folder = self.json("/" + FOLDER, fields="id,mimeType,trashed,permissions(type,role)")
        core.require(folder.get("id") == FOLDER and folder.get("mimeType") == "application/vnd.google-apps.folder"
                     and not folder.get("trashed")
                     and (not folder.get("permissions") or all(p.get("type") == "user" for p in folder["permissions"])),
                     "DRIVE_PRIVATE_FOLDER", "The selected backup folder must remain restricted to named users.")
        # A reader cannot normally see the full ACL. Restricted sharing was
        # independently checked through the owner's connector; never upgrade
        # this reader to writer merely to obtain permission metadata.
        files, seen, token = {}, set(), None
        while True:
            params = dict(q="'" + FOLDER + "' in parents and trashed = false", pageSize=100,
                          fields="nextPageToken,files(id,name,mimeType,size,parents)")
            if token:
                params["pageToken"] = token
            page = self.json(**params)
            for item in page.get("files", []):
                name = item.get("name")
                core.require(isinstance(name, str) and name not in files, "DRIVE_INVENTORY", "The selected folder contains duplicate or invalid names.")
                files[name] = item
            token = page.get("nextPageToken")
            if not token:
                return files
            core.require(isinstance(token, str) and token not in seen and len(seen) < 20,
                         "DRIVE_PAGINATION", "The backup folder listing did not terminate safely.")
            seen.add(token)

    def download(self, item, path, limit):
        file_id = item.get("id", "")
        size = int(item.get("size", -1))
        core.require(re.fullmatch(r"[A-Za-z0-9_-]{10,128}", file_id) and item.get("parents") == [FOLDER]
                     and not item.get("mimeType", "").startswith("application/vnd.google-apps.")
                     and 0 < size <= limit,
                     "DRIVE_FILE", "A selected backup file had invalid metadata, size or source membership.")
        fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        copied = 0
        with os.fdopen(fd, "wb") as output, self.open(DRIVE_BASE + "/" + file_id + "?alt=media") as response:
            while True:
                data = response.read(min(1024 * 1024, size - copied + 1))
                if not data:
                    break
                copied += len(data)
                core.require(copied <= size, "DRIVE_SIZE", "A downloaded file exceeded its declared size.")
                output.write(data)
        core.require(copied == size, "DRIVE_SIZE", "A selected backup download was incomplete.")
        return copied


def verify_report(path):
    raw = core.read_small(path)
    core.require(hashlib.sha256(raw).hexdigest() == access.REPORT_SHA256,
                 "PRIOR_REPORT", "The downloaded native restore report did not match its independently verified fingerprint.")
    report = json.loads(raw)
    core.require(report["backup_set_id"] == core.SET_ID and report["inventory_sha256"] == core.INVENTORY_SHA256
                 and report["native_database_and_roles_imported_without_ignored_errors"] is True
                 and report["storage_metadata_matches_ignoring_access_bookkeeping"] is True
                 and report["files_recovered_and_rehashed"] == 10 and report["temporary_containers_removed"] is True,
                 "PRIOR_REPORT", "The prior report did not establish the expected completed native restore.")


def download_set(drive, workspace):
    folder = workspace / "backup"
    folder.mkdir(mode=0o700)
    report = workspace / access.REPORT_NAME
    limits = {core.SET_ID + suffix: size for suffix, size in ARCHIVE_SIZES.items()}
    limits.update({core.SET_ID + suffix + ".sha256": 512 for suffix in core.SUFFIXES})
    limits.update({core.SET_ID + "-capture-inventory.json": 65536,
                   core.SET_ID + "-capture-inventory.json.sha256": 512, "READ_ME.txt": 65536,
                   access.REPORT_NAME: 16384})
    items = drive.list_files()
    core.require(set(items) == set(limits), "DRIVE_INVENTORY", "The selected folder must contain the original eleven backup files and the exact verified restore report.")
    copied = 0
    for name in sorted(limits):
        copied += drive.download(items[name], report if name == access.REPORT_NAME else folder / name, limits[name])
        core.require(copied <= MAX_DOWNLOAD, "DRIVE_BUDGET", "The selected set exceeded its fixed download bound.")
    verify_report(report)
    core.verify_backup(folder)
    return folder


def restore_copy(folder, inputs):
    stack = access.Stack()
    try:
        reference = core.read_reference(folder, inputs.backup_passphrase)
        core.require(len(reference["file_hashes"]) == 10, "NATIVE_FILES", "The selected native set must cover all ten original files.")
        stack.start_database()
        stack.database.restore(folder, inputs.backup_passphrase)
        core.compare_database(stack.database.catalog(), reference)
        core.require(core.restore_files(stack.database, folder / (core.SET_ID + "-storage_files.tar.gz.enc"),
                                        inputs.backup_passphrase, reference) == 10,
                     "NATIVE_FILES", "Not all ten backed-up files were recovered.")
        schema = access.private_sql(stack.database, access.SCHEMA_STATE)
        stack.services()
        core.require(access.private_sql(stack.database, access.SCHEMA_STATE) == schema,
                     "NATIVE_SCHEMA", "Starting restored APIs changed the migration or policy contract.")
        objects = {x["id"]: x for x in reference["before"]["objects"]}
        for record in reference["file_hashes"]:
            access.stage_backend(stack, record, objects[record["object_id"]])
            access.assert_bytes(stack.request("storage", access.storage_path(record), token=stack.service_token, digest=True), record)
        core.compare_database(stack.database.catalog(), reference)
        user_id = access.account_info(stack, inputs.owner_email)
        proofs = access.private_proofs(reference, user_id)
        core.require(bool(proofs), "PRIVATE_PROOF_OWNER", "Use the restored account that uploaded a backed-up private proof document.")
        owner_token = stack.login(inputs.owner_email, inputs.owner_password, user_id)
        stranger = stack.create_generated_account()
        core.require(stranger["id"] != user_id, "NATIVE_TEST_ACCOUNT", "The unrelated test identity was not distinct.")
        other_token = stack.login(stranger["email"], stranger["password"], stranger["id"])
        proof_count, public_count = access.exercise_access(stack, reference, owner_token, other_token, proofs)
        core.require(access.private_sql(stack.database, access.SCHEMA_STATE) == schema
                     and core.fingerprint(stack.database.catalog()) == core.fingerprint(reference["before"]),
                     "NATIVE_METADATA", "The rehearsal changed original Storage metadata or migration/policy definitions.")
        return {"owner_private_proofs_byte_verified": proof_count, "public_original_files_byte_verified": public_count}
    finally:
        stack.cleanup()  # Includes failed imports, invalid account details and denied access.


def safe_report(result):
    core.require(set(result) == {"owner_private_proofs_byte_verified", "public_original_files_byte_verified"}
                 and all(type(v) is int and 0 <= v <= 10 for v in result.values())
                 and result["owner_private_proofs_byte_verified"] > 0,
                 "NATIVE_REPORT", "The aggregate access result was invalid.")
    return {"format": "hustle-cloud-native-access-v1", "backup_set_id": core.SET_ID,
            "inventory_sha256": core.INVENTORY_SHA256, "prior_restore_report_sha256": access.REPORT_SHA256,
            "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "native_database_and_roles_restored": True, "original_files_recovered_and_rehashed": 10,
            "original_files_read_via_storage_api": 10, "restored_password_accounts_signed_in": 1,
            "restored_account_session_refresh_passed": True, "unrelated_generated_account_signed_in_and_refreshed": True,
            "other_user_anon_and_public_route_denied_for_same_proofs": True,
            "original_storage_metadata_and_policies_unchanged": True, "auth_and_storage_migration_ledgers_unchanged": True,
            "temporary_containers_removed": True, "downloaded_encrypted_copies_removed": True,
            "production_accessed": False, "mfa_tested": False, "oauth_tested": False,
            "existing_sessions_recovered": False, "all_accounts_tested": False,
            "message_participants_tested": False, "application_capability_flows_tested": False,
            "external_configuration_recovered": False, "cross_service_atomic": False,
            "full_disaster_recovery_verified": False, **result}


def main(argv=None):
    argparse.ArgumentParser(description=__doc__).parse_args(argv)
    os.umask(0o077)
    logging.disable(logging.CRITICAL)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    inputs = None
    try:
        inputs = take_inputs()
        root = guard()
        print("[1/3] Reading and verifying the exact encrypted backup and prior report.", flush=True)
        with tempfile.TemporaryDirectory(prefix="hustle-private-native-", dir=root) as temporary:
            drive = Drive(inputs.service_account)
            inputs.service_account = ""
            folder = download_set(drive, Path(temporary))
            drive.credentials.token = None
            del drive
            print("[2/3] Restoring an offline copy and testing original login and private-file access.", flush=True)
            result = restore_copy(folder, inputs)
        inputs = None
        cloud.assert_clean()
        core.require(not Path(temporary).exists(), "NATIVE_CLEANUP", "Encrypted staging copies were not removed.")
        print("[3/3] Writing an aggregate result after cleanup.", flush=True)
        report = safe_report(result)
        core.private_write(root / "hustle-native-access-result.json", core.canonical(report) + b"\n")
        print("PRIVATE NATIVE BACKUP LOGIN AND FILE-ACCESS CHECK PASSED.")
        print("All 10 original file hashes and Storage API reads passed; restored owner login/refresh and private-proof protection passed.")
        print("Full disaster recovery remains unverified; production was not accessed.")
        return 0
    except core.RestoreError as error:
        print("[" + error.code + "] " + error.message, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("[NATIVE_INTERRUPTED] No complete private recovery result.", file=sys.stderr)
        return 1
    except Exception as error:
        print("[NATIVE_FAILED] " + type(error).__name__ + "; no private diagnostic or passing report.", file=sys.stderr)
        return 1
    finally:
        inputs = None
        for name in SECRET_NAMES:
            os.environ.pop(name, None)


if __name__ == "__main__":
    raise SystemExit(main())
