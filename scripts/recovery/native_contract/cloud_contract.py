#!/usr/bin/env python3
"""Run generated recovery contracts on a GitHub-hosted runner, without inputs.

This entry point never calls either interactive recovery main(), reads a private
backup/report, accepts credentials, or connects to production. The existing
native and API isolation/cleanup guards remain active inside both contracts.
"""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import shutil
import signal
import sys


spec = importlib.util.spec_from_file_location(
    "hustle_generated_access", Path(__file__).with_name("hustle-access-recovery-test.py")
)
access = importlib.util.module_from_spec(spec)
spec.loader.exec_module(access)
core = access.core


def preflight():
    core.require(
        os.environ.get("GITHUB_ACTIONS") == "true"
        and os.environ.get("RUNNER_ENVIRONMENT") == "github-hosted"
        and os.environ.get("GITHUB_REPOSITORY") == "realxpen/hustle-economy-of-you"
        and os.environ.get("GITHUB_EVENT_NAME") in ("pull_request", "push", "workflow_dispatch")
        and sys.platform == "linux" and os.getuid() != 0,
        "GENERATED_RUNNER", "Use the generated-only GitHub-hosted workflow.",
    )
    blocked = [name for name, value in os.environ.items() if value and (
        name.upper().startswith(("PG", "SUPABASE", "POSTGRES", "HUSTLE_RESTORE_"))
        or name.upper() in ("DATABASE_URL", "DIRECT_URL", "DB_URL")
    )]
    core.require(not blocked, "GENERATED_ENVIRONMENT", "Recovery and production credentials must not be attached to this job.")
    core.require(all(shutil.which(name) for name in ("docker", "openssl")),
                 "GENERATED_SOFTWARE", "The runner needs Docker and OpenSSL.")
    host = os.environ.get("DOCKER_HOST", "")
    core.require(not host or host.startswith("unix:///"), "GENERATED_DOCKER", "Only the runner's local Unix Docker socket is allowed.")
    context = core.run(["docker", "context", "inspect", "--format", "{{json .Endpoints.docker.Host}}"])
    core.require(json.loads(context.stdout).startswith("unix:///"), "GENERATED_DOCKER", "A remote Docker context is not allowed.")
    core.run(["docker", "info", "--format", "{{.ServerVersion}}"])
    for image in (core.IMAGE, access.AUTH_IMAGE, access.STORAGE_IMAGE):
        if core.run(["docker", "image", "inspect", image], check=False).returncode:
            core.run(["docker", "pull", image], timeout=900)


def assert_clean():
    result = core.run(["docker", "ps", "--all", "--quiet", "--filter", "label=" + core.LABEL])
    core.require(not result.stdout.strip(), "GENERATED_CLEANUP", "A recovery-contract container remains; the job cannot pass.")


def main(argv=None):
    argparse.ArgumentParser(description=__doc__).parse_args(argv)
    os.umask(0o077)
    signal.signal(signal.SIGTERM, lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        print("[1/4] Preparing official digest-pinned images; generated data only.", flush=True)
        preflight()
        assert_clean()
        print("[2/4] Testing native roles, database, metadata, file recovery and RLS.", flush=True)
        core.synthetic_contract()
        assert_clean()
        print("[3/4] Testing native recovery followed by real Auth login/refresh and Storage access.", flush=True)
        access.generated_contract()
        print("[4/4] Verifying that generated recovery containers were removed.", flush=True)
        assert_clean()
        print("GENERATED NATIVE AND AUTH/STORAGE RECOVERY CONTRACTS PASSED.")
        print("Actual backup login/access and full disaster recovery remain unverified.")
        return 0
    except core.RestoreError as error:
        print("[" + error.code + "] " + error.message, file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("[GENERATED_INTERRUPTED] No passing recovery result.", file=sys.stderr)
        return 1
    except Exception as error:
        print("[GENERATED_FAILURE] " + type(error).__name__ + "; no passing recovery result.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
