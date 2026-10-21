#!/usr/bin/env python3
"""Rehearse Hustle login and Storage access on an isolated Ubuntu Docker copy.

Keep hustle-restore-test-v2.py beside this file in Documents, then run:
  python3 ~/Documents/hustle-access-recovery-test.py

Only the existing backup passphrase and one consenting proof owner's email and
password are requested locally, with hidden typing. No production connection,
API key, password reset, email, payment, deployment or linked project is used.
The unrelated account is generated in the disposable local copy. All containers
share one network-disabled namespace, publish no ports, use no host mounts, and
keep database/files in temporary RAM-backed storage. Generated real-API fixtures
must pass before any private backup is decrypted or account detail is requested.

This tests one restored email/password account, its session refresh, the original
private proof policy and an unrelated authenticated identity, plus all recovered
file bytes through the Storage API. It does not prove MFA/OAuth, existing sessions,
all accounts, message-participant acceptance, application capability behavior,
external configuration/Vault recovery, atomic capture or full disaster recovery.
"""

from __future__ import annotations

import argparse
import base64
from contextlib import contextmanager
from datetime import datetime, timezone
import getpass
import hashlib
import hmac
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import secrets
import signal
import stat
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote
import uuid


CORE_NAME = "hustle-restore-test-v2.py"
CORE_SHA256 = "ff7d194585a90017e25515da73e02be0cc3ebff2817cafbf5fce6001cdd4e192"
REPORT_NAME = "hustle-20261020T111134Z-9f73a014-restore-19bd1540.json"
REPORT_SHA256 = "3746cca5c372e89eb9afb27153b2e57c10653490794700a5dc897733d6344920"
AUTH_IMAGE = "docker.io/supabase/gotrue:v2.197.0@sha256:1736a63078f5922b198c4cbe50f80ab9a2d3b54fe8b7b6cfb2e9dc5dbbc12c6b"
STORAGE_IMAGE = "docker.io/supabase/storage-api:v1.80.0@sha256:15aa712fdda0dab83d6345c79b54230c1466c41161f1f3756651778b22c3b292"
ISSUER = "http://127.0.0.1:9999"
TENANT = "hustle-local-recovery"
BACKEND_BUCKET = "hustle-local-files"
STORAGE_MIGRATION = "revoke-grants-to-unused-operations"


def load_core():
    path = Path(__file__).with_name(CORE_NAME)
    try:
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_size > 100000:
            raise ValueError()
        if hashlib.sha256(path.read_bytes()).hexdigest() != CORE_SHA256:
            raise ValueError()
    except (OSError, ValueError):
        raise RuntimeError("Keep the unchanged, previously tested hustle-restore-test-v2.py beside this file in Documents.") from None
    sys.dont_write_bytecode = True
    spec = importlib.util.spec_from_file_location("hustle_verified_native_restore", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


try:
    core = load_core()
except RuntimeError as error:
    print("[VERIFIED_CORE] " + str(error), file=sys.stderr)
    raise SystemExit(1)

require = core.require
RestoreError = core.RestoreError


# Private JSON requests travel over docker exec stdin. Only fixed loopback ports
# are reachable, and redirects are not followed. File bytes become digests only.
HTTP_WORKER = r'''
const http = require('node:http');
const crypto = require('node:crypto');
let input = Buffer.alloc(0);
process.stdin.on('data', x => {
  input = Buffer.concat([input, x]);
  if (input.length > 2*1024*1024) process.exit(2);
});
process.stdin.on('end', () => {
  try {
    const q = JSON.parse(input.toString('utf8'));
    const port = q.service === 'auth' ? 9999 : q.service === 'storage' ? 5000 : 0;
    if (!port || !['GET','POST'].includes(q.method) || typeof q.path !== 'string' ||
        !q.path.startsWith('/') || q.path.startsWith('//') || /[\r\n\\\x00]/.test(q.path)) throw Error();
    const headers = {'Connection':'close'};
    if (q.token) headers.Authorization = 'Bearer '+q.token;
    let body;
    if (q.binary !== undefined) {
      body = Buffer.from(q.binary,'base64'); headers['Content-Type'] = q.contentType || 'application/octet-stream';
    } else if (q.body !== undefined) {
      body = Buffer.from(JSON.stringify(q.body)); headers['Content-Type'] = 'application/json';
    }
    if (body) headers['Content-Length'] = String(body.length);
    const request = http.request({hostname:'127.0.0.1', port, path:q.path, method:q.method,
      headers, timeout:15000, agent:false}, response => {
      const digest = crypto.createHash('sha256'); let size=0; let parts=[];
      response.on('data', data => {
        size += data.length;
        if (size > 256*1024*1024) { response.destroy(); return; }
        digest.update(data);
        if (!(q.digest && response.statusCode === 200)) {
          if (size > 1024*1024) { response.destroy(); return; }
          parts.push(data);
        }
      });
      response.on('error', () => process.exit(3));
      response.on('end', () => {
        const out = {status:response.statusCode, size,
          contentType:response.headers['content-type'] || ''};
        if (q.digest && response.statusCode === 200) out.sha256 = digest.digest('hex');
        else { try { out.json = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { out.json = null; } }
        process.stdout.write(JSON.stringify(out));
      });
    });
    request.on('timeout', () => request.destroy());
    request.on('error', () => process.exit(3));
    request.end(body);
  } catch { process.exit(2); }
});
'''


# This calls the pinned Storage image's physical FileBackend adapter directly.
# Its real uploadObject implementation supplies the version layout and xattrs;
# there is no Storage HTTP upload and no replacement of storage.objects rows.
FILE_WORKER = r'''
process.umask(0o077);
const crypto = require('node:crypto');
const {PassThrough} = require('node:stream');
let header=Buffer.alloc(0), writer, done, record, total=0;
const hash=crypto.createHash('sha256');
function fail() { process.exit(4); }
process.stdin.on('data', chunk => {
  try {
    if (!record) {
      const position=chunk.indexOf(10);
      if (position < 0) { header=Buffer.concat([header,chunk]); if(header.length>65536)fail(); return; }
      header=Buffer.concat([header,chunk.subarray(0,position)]);
      if(header.length>65536)fail();
      record=JSON.parse(header.toString('utf8')); chunk=chunk.subarray(position+1);
      if(record.root!=='hustle-local-files' || record.tenant!=='hustle-local-recovery' ||
         !Number.isSafeInteger(record.size) || record.size<0 || record.size>256*1024*1024 ||
         !/^[0-9a-f]{64}$/.test(record.sha256))fail();
      const pieces=[record.bucket,...record.name.split('/'),...(record.version?[record.version]:[])];
      if(pieces.some(x=>typeof x!=='string'||!x||x==='.'||x==='..'||/[\/\\\x00-\x1f\x7f]/.test(x)))fail();
      const {FileBackend}=require('/app/dist/storage/backend/file.js');
      const backend=new FileBackend(); writer=new PassThrough();
      done=backend.uploadObject(record.root,record.tenant+'/'+record.bucket+'/'+record.name,
        record.version || undefined,writer,record.mimetype,record.cacheControl,undefined,
        record.size,record.contentEncoding || undefined);
      done.catch(fail);
    }
    total+=chunk.length; if(total>record.size)fail();
    hash.update(chunk);
    if(!writer.write(chunk)) { process.stdin.pause(); writer.once('drain',()=>process.stdin.resume()); }
  } catch { fail(); }
});
process.stdin.on('end', async () => {
  try {
    if(!record || total!==record.size || hash.digest('hex')!==record.sha256)fail();
    writer.end(); await done;
    process.stdout.write(JSON.stringify({size:total,sha256:record.sha256}));
  } catch { fail(); }
});
process.stdin.on('error',fail);
'''


def b64(raw):
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def local_jwt(secret, role):
    now = int(time.time())
    fields = {"iss": ISSUER, "role": role, "iat": now, "exp": now + 7200}
    encoded = b64(core.canonical({"alg": "HS256", "typ": "JWT"})) + "." + b64(core.canonical(fields))
    return encoded + "." + b64(hmac.new(secret.encode(), encoded.encode(), hashlib.sha256).digest())


def validate_user_token(token, secret, expected_id):
    try:
        parts = token.split(".")
        require(len(parts) == 3, "LOCAL_TOKEN", "The local login token was invalid.")
        signature = b64(hmac.new(secret.encode(), (parts[0]+"."+parts[1]).encode(), hashlib.sha256).digest())
        require(hmac.compare_digest(parts[2], signature), "LOCAL_TOKEN", "The login token did not use the new local signing key.")
        header, claims = (json.loads(base64.urlsafe_b64decode(x + "=" * (-len(x) % 4))) for x in parts[:2])
        audience = claims.get("aud")
        require(header["alg"] == "HS256" and claims["iss"] == ISSUER and
                claims["sub"] == expected_id and claims["role"] == "authenticated" and
                (audience == "authenticated" or isinstance(audience, list) and "authenticated" in audience) and
                claims["exp"] > time.time() and claims["iat"] <= time.time() + 60 and
                bool(uuid.UUID(claims["session_id"])),
                "LOCAL_TOKEN", "The local login token did not match the restored account and normal user role.")
        return claims
    except RestoreError:
        raise
    except (KeyError, ValueError, TypeError, AttributeError):
        raise RestoreError("LOCAL_TOKEN", "The local login token had an invalid structure.") from None


def private_run(args, *, data=None, values=None, timeout=90):
    environment = core.clean_environment()
    if values:
        environment.update(values)  # Only fresh local service configuration.
    try:
        result = subprocess.run(args, input=data, capture_output=True, timeout=timeout, env=environment)
    except (OSError, subprocess.SubprocessError):
        raise RestoreError("LOCAL_API_COMMAND", "A local service command could not finish. No private output was printed.") from None
    require(len(result.stdout) <= core.LIMIT and len(result.stderr) <= core.LIMIT,
            "LOCAL_API_OUTPUT", "A local service exceeded its private output limit.")
    return result


def sql_literal(text):
    require(isinstance(text, str) and len(text) <= 1024 and "\0" not in text,
            "LOCAL_SQL_INPUT", "A local account selector was invalid.")
    return "'" + text.replace("'", "''") + "'"


def private_sql(database, text):
    database.guard()
    command = database.command("psql", ["--dbname=postgres", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=sqlstate", "-f", "-"], True)
    result = private_run(command, data=text.encode())
    if result.returncode:
        raise core.import_error("LOCAL_API_DATABASE", result.stderr)
    return result.stdout.strip()


class ApiDatabase(core.Database):
    def start(self):
        original = core.BOOT
        require(original.count("-c listen_addresses= ") == 1 and original.count("max_connections=10") == 1,
                "VERIFIED_CORE", "The verified database startup contract changed.")
        # Only sibling test containers share this otherwise network-disabled
        # namespace. Nothing is published to the host or another Docker network.
        core.BOOT = original.replace("-c listen_addresses= ", "-c listen_addresses=127.0.0.1 ").replace("max_connections=10", "max_connections=30")
        try:
            super().start()
        finally:
            core.BOOT = original
        require(self.sql("SHOW listen_addresses;") == b"127.0.0.1", "LOCAL_DATABASE_BIND", "The test database did not bind only to its private loopback interface.")
        self.container_id = json.loads(core.run(["docker", "inspect", self.name]).stdout)[0]["Id"]


class Service(core.Database):
    def __init__(self, database, kind, values, *, migrate=False):
        super().__init__()
        self.database, self.kind, self.values = database, kind, values
        self.name = "hustle-private-" + kind + "-" + self.token
        self.image = AUTH_IMAGE if kind == "auth" else STORAGE_IMAGE
        self.migrate = migrate

    def command(self, program, args=(), input_stream=False):
        require(self.created, "LOCAL_SERVICE", "The owned test service is not ready.")
        return ["docker", "exec"] + (["-i"] if input_stream else []) + ["--user", "1000:1000", self.name, program] + list(args)

    def start(self):
        self.database.guard()
        args = ["docker", "create", "--name", self.name, "--label", core.LABEL + "=" + self.token,
                "--network", "container:" + self.database.name, "--read-only", "--cap-drop=ALL",
                "--security-opt=no-new-privileges", "--user", "1000:1000", "--memory=512m",
                "--pids-limit=128", "--cpus=1", "--no-healthcheck", "--log-driver=none",
                "--tmpfs", "/tmp:rw,nosuid,nodev,noexec,size=384m,mode=1777"]
        for key in self.values:
            args += ["--env", key]  # Values never appear in command arguments.
        if self.kind == "auth":
            program = "/usr/local/bin/auth" + ("" if self.migrate else " serve")
        else:
            program = "node /app/dist/start/server.js"
            args += ["--workdir", "/app"]
        # Keep failed-start diagnostics only in this container's private tmpfs.
        # A holding process lets us classify a failure before deleting the copy.
        boot = "umask 077; " + program + " >/tmp/startup-private.log 2>&1; printf stopped >/tmp/service-exited; exec sleep 86400"
        args += ["--entrypoint", "/bin/sh", self.image, "-c", boot]
        self.created = True
        result = private_run(args, values=self.values, timeout=60)
        require(result.returncode == 0, "LOCAL_SERVICE_CREATE", "An isolated API container could not be created.")
        self.guard()
        core.run(["docker", "start", self.name])

    def stopped_category(self):
        script = '''if [ -f /tmp/service-exited ]; then
if grep -Eqi 'hash.*mismatch|hash.*match|has changed since|invalid migration' /tmp/startup-private.log; then printf MIGRATION_CONTRACT;
elif grep -Eqi 'permission denied|insufficient privilege|must be owner' /tmp/startup-private.log; then printf DATABASE_PRIVILEGE;
elif grep -Eqi 'MODULE_NOT_FOUND|Cannot find module|ERR_DLOPEN_FAILED' /tmp/startup-private.log; then printf IMAGE_MODULE;
elif grep -Eqi 'ECONNREFUSED|connection refused|error opening database' /tmp/startup-private.log; then printf DATABASE_CONNECTION;
elif grep -Eqi 'configuration|config:|required|not set|invalid.*environment' /tmp/startup-private.log; then printf CONFIGURATION;
else printf UNCLASSIFIED_START; fi
fi'''
        result = core.run(self.command("/bin/sh",["-c",script]),check=False)
        value = result.stdout.strip()
        allowed = (b"MIGRATION_CONTRACT",b"DATABASE_PRIVILEGE",b"IMAGE_MODULE",b"DATABASE_CONNECTION",b"CONFIGURATION",b"UNCLASSIFIED_START")
        require(not value or value in allowed,"LOCAL_API_DIAGNOSTIC","A local startup diagnostic was invalid.")
        return value.decode("ascii")

    def guard(self):
        self.database.guard()
        obj = json.loads(core.run(["docker", "inspect", self.name]).stdout)[0]
        config, host = obj["Config"], obj["HostConfig"]
        mode = host.get("NetworkMode", "")
        namespace = mode.removeprefix("container:") if mode.startswith("container:") else ""
        environment = dict(item.split("=", 1) for item in config.get("Env", []) if "=" in item)
        require(config.get("Labels", {}).get(core.LABEL) == self.token and obj["Name"] == "/" + self.name and
                config["Image"] in (self.image, self.image.removeprefix("docker.io/")) and
                config["User"] == "1000:1000" and namespace in (self.database.name, self.database.container_id) and
                host.get("ReadonlyRootfs") and "ALL" in {x.upper() for x in host.get("CapDrop", [])} and
                not host.get("Privileged") and not host.get("Binds") and not host.get("PortBindings") and
                all(x.get("Type") == "tmpfs" and x.get("Destination") == "/tmp" for x in obj.get("Mounts", [])) and
                "/tmp" in host.get("Tmpfs", {}) and host.get("LogConfig", {}).get("Type") == "none" and
                any(x.startswith("no-new-privileges") for x in host.get("SecurityOpt", [])) and
                all(environment.get(k) == v for k, v in self.values.items()),
                "LOCAL_API_ISOLATION", "A test API did not meet the offline isolation and local-key requirements.")


class Stack:
    def __init__(self):
        self.database = ApiDatabase()
        self.secret = secrets.token_urlsafe(48)
        self.service_token = local_jwt(self.secret, "service_role")
        self.anon_token = local_jwt(self.secret, "anon")
        self.resources = [self.database]
        self.storage = self.auth = None

    def start_database(self):
        self.database.start()

    def request(self, service, path, *, method="GET", body=None, token=None, digest=False, binary=None):
        require(self.storage is not None, "LOCAL_HTTP_CLIENT", "The isolated HTTP client is not ready.")
        self.storage.guard()
        request = {"service": service, "path": path, "method": method, "digest": digest}
        if body is not None: request["body"] = body
        if token is not None: request["token"] = token
        if binary is not None: request["binary"] = base64.b64encode(binary).decode()
        result = private_run(self.storage.command("node", ["-e", HTTP_WORKER], True), data=core.canonical(request), timeout=40)
        require(result.returncode == 0, "LOCAL_HTTP", "A request inside the isolated copy failed. No response body or account detail was printed.")
        try:
            response = json.loads(result.stdout)
            require(isinstance(response.get("status"), int), "LOCAL_HTTP", "The local response was invalid.")
            return response
        except (ValueError, TypeError, AttributeError):
            raise RestoreError("LOCAL_HTTP", "The local response could not be validated.") from None

    def services(self, *, fixture=False):
        common = {"HOME": "/tmp", "NODE_OPTIONS": "", "LOG_LEVEL": "fatal"}
        values = dict(common, GOTRUE_API_HOST="127.0.0.1", GOTRUE_API_PORT="9999", API_EXTERNAL_URL=ISSUER,
                      GOTRUE_SITE_URL=ISSUER, GOTRUE_DB_DRIVER="postgres",
                      GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin@127.0.0.1:5432/postgres?sslmode=disable",
                      GOTRUE_DB_NAMESPACE="auth", GOTRUE_DB_MAX_POOL_SIZE="3", GOTRUE_DB_MAX_IDLE_POOL_SIZE="1",
                      GOTRUE_DB_ADVISOR_ENABLED="false", GOTRUE_DISABLE_SIGNUP="true",
                      GOTRUE_EXTERNAL_EMAIL_ENABLED="true", GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED="false",
                      GOTRUE_EXTERNAL_PHONE_ENABLED="false", GOTRUE_EXTERNAL_GOOGLE_ENABLED="false",
                      GOTRUE_JWT_SECRET=self.secret, GOTRUE_JWT_ISSUER=ISSUER, GOTRUE_JWT_AUD="authenticated",
                      GOTRUE_JWT_DEFAULT_GROUP_NAME="authenticated", GOTRUE_JWT_ADMIN_ROLES="service_role",
                      GOTRUE_JWT_EXP="3600", GOTRUE_MAILER_AUTOCONFIRM="false", GOTRUE_MAILER_NOTIFICATIONS_ENABLED="false",
                      GOTRUE_SMTP_HOST="127.0.0.1", GOTRUE_SMTP_PORT="1", GOTRUE_SMTP_ADMIN_EMAIL="local@hustle.invalid",
                      GOTRUE_SMTP_SENDER_NAME="Local recovery", GOTRUE_LOG_LEVEL="fatal",
                      GOTRUE_HOOK_SEND_EMAIL_ENABLED="false", GOTRUE_HOOK_SEND_SMS_ENABLED="false",
                      GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED="false", GOTRUE_HOOK_PASSWORD_VERIFICATION_ATTEMPT_ENABLED="false",
                      GOTRUE_HOOK_MFA_VERIFICATION_ATTEMPT_ENABLED="false", GOTRUE_TRACING_ENABLED="false")
        self.auth = Service(self.database, "auth", values, migrate=fixture)
        self.resources.append(self.auth)
        self.auth.start()
        values = dict(common, SERVER_HOST="127.0.0.1", SERVER_PORT="5000", SERVER_ADMIN_PORT="5001",
                      STORAGE_BACKEND="file", FILE_STORAGE_BACKEND_PATH="/tmp/backend", STORAGE_FILE_ETAG_ALGORITHM="md5",
                      TENANT_ID=TENANT, GLOBAL_S3_BUCKET=BACKEND_BUCKET, REGION="local",
                      AUTH_JWT_SECRET=self.secret, AUTH_JWT_ALGORITHM="HS256",
                      ANON_KEY=self.anon_token, SERVICE_KEY=self.service_token,
                      DATABASE_URL="postgres://supabase_storage_admin@127.0.0.1:5432/postgres?sslmode=disable",
                      DATABASE_MAX_CONNECTIONS="3", DATABASE_POSTGRES_VERSION="17", DATABASE_SEARCH_PATH="storage,public,extensions",
                      DB_SUPER_USER="postgres", DB_INSTALL_ROLES="false", DB_ALLOW_MIGRATION_REFRESH="false",
                      DB_MIGRATIONS_FREEZE_AT=STORAGE_MIGRATION, PG_QUEUE_ENABLE="false", PG_QUEUE_WORKERS_ENABLE="false",
                      ENABLE_IMAGE_TRANSFORMATION="false", VECTOR_STORE_MIGRATIONS_ENABLED="false",
                      STORAGE_LIFECYCLE_ENABLED="false", FILE_SIZE_LIMIT=str(256*1024*1024), TUS_USE_FILE_VERSION_SEPARATOR="false",
                      S3_PROTOCOL_ACCESS_KEY_ID="", S3_PROTOCOL_ACCESS_KEY_SECRET="", TRACING_ENABLED="false")
        self.storage = Service(self.database, "storage", values)
        self.resources.append(self.storage)
        self.storage.start()
        self.wait("auth", "/health")
        self.wait("storage", "/status")

    def wait(self, kind, path):
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            service = self.auth if kind == "auth" else self.storage
            state = core.run(["docker", "inspect", "--format", "{{.State.Running}}", service.name], check=False)
            require(state.stdout.strip() == b"true", "LOCAL_" + kind.upper() + "_START", "The isolated " + kind + " API stopped before it became ready. No private logs were printed.")
            category = service.stopped_category()
            require(not category,"LOCAL_"+kind.upper()+"_"+category,"The isolated "+kind+" API could not start. Only a fixed diagnostic category is shown; private logs will be removed.")
            try:
                if self.request(kind, path)["status"] == 200:
                    return
            except RestoreError:
                pass
            time.sleep(0.4)
        raise RestoreError("LOCAL_API_READY", "An isolated API did not become ready within two minutes.")

    def create_generated_account(self):
        email = "recovery-" + uuid.uuid4().hex + "@hustle.invalid"
        password = secrets.token_urlsafe(32)
        response = self.request("auth", "/admin/users", method="POST", token=self.service_token,
                                body={"email": email, "password": password, "email_confirm": True})
        account = response.get("json") or {}
        user_id = account.get("id")
        require(response["status"] in (200, 201) and user_id and str(uuid.UUID(user_id)) == user_id,
                "LOCAL_TEST_ACCOUNT", "The temporary unrelated account could not be created inside the local copy.")
        return {"id": user_id, "email": email, "password": password}

    def login(self, email, password, expected_id):
        response = self.request("auth", "/token?grant_type=password", method="POST", body={"email": email, "password": password})
        result = response.get("json") or {}
        require(response["status"] == 200, "LOCAL_SIGNIN", "Sign-in to the restored copy failed. Use an existing email/password account and its password at capture time; no password reset was attempted.")
        token = result.get("access_token", "")
        validate_user_token(token, self.secret, expected_id)
        user = self.request("auth", "/user", token=token)
        require(user["status"] == 200 and (user.get("json") or {}).get("id") == expected_id,
                "LOCAL_SESSION", "The local session did not identify the expected account.")
        refresh = result.get("refresh_token")
        require(isinstance(refresh, str) and refresh, "LOCAL_REFRESH", "The local sign-in did not issue a refresh token.")
        response = self.request("auth", "/token?grant_type=refresh_token", method="POST", body={"refresh_token": refresh})
        refreshed = response.get("json") or {}
        require(response["status"] == 200 and refreshed.get("refresh_token"), "LOCAL_REFRESH", "Session refresh failed in the restored copy.")
        token = refreshed.get("access_token", "")
        validate_user_token(token, self.secret, expected_id)
        user = self.request("auth", "/user", token=token)
        require(user["status"] == 200 and (user.get("json") or {}).get("id") == expected_id,
                "LOCAL_REFRESH", "The refreshed session did not identify the expected account.")
        return token

    def cleanup(self):
        core.cleanup_all(self.resources)


def storage_path(record, *, public=False):
    pieces = [record["bucket_id"]] + record["name"].split("/")
    require(all(isinstance(p, str) and p and p not in (".", "..") and not re.search(r"[/\\\x00-\x1f\x7f]", p) for p in pieces),
            "STORAGE_PATH", "An object path could not safely be used in the local recovery adapter.")
    return "/object/" + ("public/" if public else "") + "/".join(quote(x, safe="") for x in pieces)


def assert_bytes(response, record):
    require(response["status"] == 200 and response.get("size") == record["size_bytes"] and
            response.get("sha256") == record["sha256"], "LOCAL_STORAGE_BYTES", "An object read through the local Storage API did not match its original file digest.")


def assert_denied(response):
    error = response.get("json") or {}
    # A failed connection, server error or invalid JWT is not policy proof.
    code = error.get("code") or error.get("error")
    require(response["status"] in (400, 401, 403, 404) and
            code in ("NoSuchKey", "NoSuchBucket", "AccessDenied", "not_found", "NotFound", "Forbidden"),
            "LOCAL_STORAGE_DENIAL", "A private-file denial was not the expected policy/not-found response. No successful privacy result is reported.")


def backend_header(record, obj):
    storage_path(record)
    version = record.get("version")
    require(version is None or isinstance(version, str) and version and "/" not in version and
            not re.search(r"[\\\x00-\x1f\x7f]", version) and version not in (".", ".."),
            "STORAGE_VERSION", "An original object version was invalid.")
    metadata = obj.get("metadata") or {}
    return {"root": BACKEND_BUCKET, "tenant": TENANT, "bucket": record["bucket_id"], "name": record["name"],
            "version": version, "size": record["size_bytes"], "sha256": record["sha256"],
            "mimetype": metadata.get("mimetype") or "application/octet-stream",
            "cacheControl": metadata.get("cacheControl") or "no-cache",
            "contentEncoding": metadata.get("contentEncoding")}


def stage_backend(stack, record, obj, *, data=None):
    stack.storage.guard()
    header = core.canonical(backend_header(record, obj)) + b"\n"
    source = target = errors = source_errors = timer = None
    try:
        target = subprocess.Popen(stack.storage.command("node", ["-e", FILE_WORKER], True), stdin=subprocess.PIPE,
                                  stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=core.clean_environment())
        errors = core.Errors(target.stderr)
        timer = core.watchdog(target)
        target.stdin.write(header)
        if data is not None:
            target.stdin.write(data)
        else:
            source = subprocess.Popen(stack.database.command("cat", ["/tmp/hustle/files/" + record["relative_path"]]),
                                      stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL, env=core.clean_environment())
            source_errors = core.Errors(source.stderr)
            total = 0
            for chunk in iter(lambda: source.stdout.read(1024*1024), b""):
                total += len(chunk)
                require(total <= record["size_bytes"], "LOCAL_FILE_ADAPTER", "A recovered file exceeded its expected size.")
                target.stdin.write(chunk)
            require(source.wait(timeout=30) == 0 and total == record["size_bytes"], "LOCAL_FILE_ADAPTER", "A recovered file could not be copied to the local physical backend.")
        target.stdin.close()
        raw = target.stdout.read(core.LIMIT + 1)
        require(len(raw) <= core.LIMIT and target.wait(timeout=60) == 0,
                "LOCAL_FILE_ADAPTER", "The pinned physical file recovery adapter failed. No private path was printed.")
        result = json.loads(raw)
        require(result == {"size": record["size_bytes"], "sha256": record["sha256"]},
                "LOCAL_FILE_ADAPTER", "The physical file adapter did not verify the expected bytes.")
    except (BrokenPipeError, ValueError):
        raise RestoreError("LOCAL_FILE_ADAPTER", "The physical file recovery adapter stopped. No private error output was printed.") from None
    finally:
        if timer: timer.cancel()
        if source: core.stop(source)
        if target: core.stop(target)
        if source_errors: source_errors.finish()
        if errors: errors.finish()


SCHEMA_STATE = '''BEGIN READ ONLY; SELECT json_build_object(
'auth_migrations',(SELECT json_agg(version ORDER BY version) FROM auth.schema_migrations),
'storage_migrations',(SELECT json_agg(to_jsonb(m) ORDER BY id) FROM storage.migrations m),
'storage_policies',(SELECT json_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='storage'),
'rls',(SELECT json_agg(json_build_array(c.relname,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='storage' AND c.relkind='r')
); COMMIT;'''


def account_info(stack, email):
    require(isinstance(email, str) and 3 <= len(email) <= 320 and "@" in email and not any(x in email for x in "\r\n\0"),
            "PASSWORD_ACCOUNT", "Use a consenting existing email/password Hustle account. Google-only login is not tested by this helper.")
    data = json.loads(private_sql(stack.database, "BEGIN READ ONLY; SELECT coalesce((SELECT json_build_object('id',u.id,'confirmed',u.email_confirmed_at IS NOT NULL,'has_password',coalesce(u.encrypted_password,'')<>'','banned',coalesce(u.banned_until>now(),false),'mfa',EXISTS(SELECT 1 FROM auth.mfa_factors f WHERE f.user_id=u.id AND f.status='verified')) FROM auth.users u WHERE lower(u.email)=lower(" + sql_literal(email) + ") AND u.deleted_at IS NULL),'null'::json); COMMIT;"))
    require(isinstance(data, dict) and data.get("confirmed") and data.get("has_password") and not data.get("banned"),
            "PASSWORD_ACCOUNT", "That restored account is not a confirmed, active email/password account. No account change was attempted.")
    require(not data.get("mfa"), "MFA_SEPARATE", "This account requires a separate MFA recovery rehearsal. Choose an account without MFA for this password-only check.")
    return data["id"]


def private_proofs(reference, user_id):
    buckets = {x["id"]: x for x in reference["before"]["buckets"]}
    return [r for r in reference["file_hashes"] if r["bucket_id"] in ("agent-proofs", "hustler-proofs") and
            buckets[r["bucket_id"]].get("public") is False and r["name"].split("/")[0] == user_id]


def exercise_access(stack, reference, owner_token, outsider_token, proofs):
    # Admin proves file wiring only. Normal user tokens are used for all policy assertions.
    for record in reference["file_hashes"]:
        assert_bytes(stack.request("storage", storage_path(record), token=stack.service_token, digest=True), record)
    require(proofs, "PRIVATE_PROOF_OWNER", "This restored account has no backed-up private proof document. Use the account that uploaded a proof; no policy was changed.")
    for record in proofs:
        path = storage_path(record)
        assert_bytes(stack.request("storage", path, token=owner_token, digest=True), record)
        assert_denied(stack.request("storage", path, token=outsider_token, digest=True))
        assert_denied(stack.request("storage", path, token=stack.anon_token, digest=True))
        assert_denied(stack.request("storage", storage_path(record, public=True), digest=True))
    public = {b["id"] for b in reference["before"]["buckets"] if b.get("public") is True}
    public_count = 0
    for record in reference["file_hashes"]:
        if record["bucket_id"] in public:
            assert_bytes(stack.request("storage", storage_path(record, public=True), digest=True), record)
            public_count += 1
    return len(proofs), public_count


FIXTURE_SETUP = '''
CREATE ROLE postgres LOGIN NOSUPERUSER CREATEROLE CREATEDB;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE authenticator LOGIN NOINHERIT;
GRANT anon,authenticated,service_role TO authenticator;
CREATE ROLE supabase_auth_admin LOGIN NOINHERIT CREATEROLE;
CREATE ROLE supabase_storage_admin LOGIN NOINHERIT CREATEROLE;
GRANT authenticator TO supabase_storage_admin;
CREATE SCHEMA extensions;
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION "uuid-ossp" WITH SCHEMA extensions;
CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;
CREATE SCHEMA storage AUTHORIZATION supabase_storage_admin;
GRANT USAGE ON SCHEMA auth,extensions TO anon,authenticated,service_role,supabase_auth_admin,supabase_storage_admin;
GRANT USAGE ON SCHEMA storage TO postgres,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON TABLES TO postgres,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON FUNCTIONS TO postgres,anon,authenticated,service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_storage_admin IN SCHEMA storage GRANT ALL ON SEQUENCES TO postgres,anon,authenticated,service_role;
ALTER ROLE supabase_auth_admin SET search_path=auth,public,extensions;
ALTER ROLE supabase_storage_admin SET search_path=storage,public,extensions;
CREATE TABLE public."User"(id uuid PRIMARY KEY);
CREATE TABLE public."Service"(id integer PRIMARY KEY);
CREATE TABLE public."Booking"(id integer PRIMARY KEY);
CREATE TABLE public."Notification"(id integer PRIMARY KEY);
CREATE TABLE public._prisma_migrations(id text PRIMARY KEY);
CREATE SCHEMA supabase_migrations;
CREATE TABLE supabase_migrations.schema_migrations(version text PRIMARY KEY);
INSERT INTO public."Service" VALUES(1); INSERT INTO public."Booking" VALUES(1);
INSERT INTO public."Notification" VALUES(1);
INSERT INTO public._prisma_migrations VALUES('generated');
INSERT INTO supabase_migrations.schema_migrations VALUES('generated');
'''


FIXTURE_AUTH_HELPERS = '''
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $f$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
$f$;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
 SELECT coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role');
$f$;
CREATE OR REPLACE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $f$
 SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$f$;
'''


def reference_from_files(catalog, payloads):
    reference = {"before": catalog, "after": json.loads(json.dumps(catalog)), "file_hashes": []}
    for obj in catalog["objects"]:
        key = (obj["bucket_id"], obj["name"])
        data = payloads[key]
        reference["file_hashes"].append({"bucket_id": key[0], "name": key[1], "object_id": obj["id"], "version": obj.get("version"),
            "relative_path": "objects/"+hashlib.sha256((key[0]+"\0"+key[1]).encode()).hexdigest(),
            "size_bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()})
    return reference


def generated_contract():
    source, target = Stack(), Stack()
    try:
        source.start_database()
        private_sql(source.database, FIXTURE_SETUP)
        source.services(fixture=True)
        private_sql(source.database, FIXTURE_AUTH_HELPERS)
        owner, outsider = source.create_generated_account(), source.create_generated_account()
        private_sql(source.database, "INSERT INTO public.\"User\" VALUES("+sql_literal(owner["id"])+"),("+sql_literal(outsider["id"])+");")
        for name, public in (("hustler-proofs", False), ("fixture-public", True)):
            response = source.request("storage", "/bucket", method="POST", token=source.service_token,
                                      body={"id": name, "name": name, "public": public})
            require(response["status"] in (200, 201), "API_FIXTURE_BUCKET", "The generated API bucket could not be prepared.")
        private_sql(source.database, "CREATE POLICY fixture_proof_owner ON storage.objects FOR SELECT TO authenticated USING(bucket_id='hustler-proofs' AND (storage.foldername(name))[1]=auth.uid()::text);")
        payloads = {("hustler-proofs", owner["id"]+"/proof.txt"): b"Generated private recovery proof.\n",
                    ("fixture-public", "public.txt"): b"Generated public recovery proof.\n"}
        for (bucket, name), payload in payloads.items():
            response = source.request("storage", storage_path({"bucket_id": bucket, "name": name}),
                                      method="POST", token=source.service_token, binary=payload)
            require(response["status"] in (200, 201), "API_FIXTURE_UPLOAD", "A generated API file could not be prepared.")
        reference = reference_from_files(source.database.catalog(), payloads)
        schema = private_sql(source.database, SCHEMA_STATE)
        password = "generated-api-recovery-fixtures-only"
        with tempfile.TemporaryDirectory(prefix="hustle-generated-api-fixtures-") as directory:
            folder = Path(directory)
            for suffix, command in (("-roles.sql.enc", source.database.command("pg_dumpall", ["--roles-only", "--no-role-passwords", "--database=postgres"])),
                                    ("-database.pgdump.enc", source.database.command("pg_dump", ["--dbname=postgres", "--format=custom", "--quote-all-identifiers", "--no-subscriptions"]))):
                core.encrypt_fixture(folder / (core.SET_ID+suffix), password, command=command)
            source.cleanup()
            target.start_database()
            target.database.restore(folder, password)
            core.compare_database(target.database.catalog(), reference)
            target.services()
            require(private_sql(target.database, SCHEMA_STATE) == schema, "API_FIXTURE_SCHEMA", "Starting the APIs changed the generated restored migration/policy contract.")
            for record in reference["file_hashes"]:
                obj = next(x for x in reference["before"]["objects"] if x["id"] == record["object_id"])
                stage_backend(target, record, obj, data=payloads[(record["bucket_id"],record["name"])])
            owner_token = target.login(owner["email"], owner["password"], owner["id"])
            other_token = target.login(outsider["email"], outsider["password"], outsider["id"])
            result = exercise_access(target, reference, owner_token, other_token, private_proofs(reference, owner["id"]))
            require(result == (1,1), "API_FIXTURE_ACCESS", "The generated owner/other-user/public-file contract failed.")
            core.compare_database(target.database.catalog(), reference)
    finally:
        try:
            source.cleanup()
        finally:
            target.cleanup()


def verify_report():
    path = Path.home()/"Hustle-Restore-Checks"/REPORT_NAME
    raw = core.read_small(path)
    require(hashlib.sha256(raw).hexdigest() == REPORT_SHA256, "PRIOR_REPORT", "The independently verified passing native-restore report was not found unchanged.")
    report = json.loads(raw)
    require(report["backup_set_id"] == core.SET_ID and report["inventory_sha256"] == core.INVENTORY_SHA256 and
            report["native_database_and_roles_imported_without_ignored_errors"] is True and
            report["storage_metadata_matches_ignoring_access_bookkeeping"] is True and
            report["files_recovered_and_rehashed"] == 10 and report["temporary_containers_removed"] is True,
            "PRIOR_REPORT", "The prior restore report did not cover the expected backup.")


def preflight():
    core.preflight()
    for name, image in (("Auth",AUTH_IMAGE),("Storage",STORAGE_IMAGE)):
        print("Preparing the pinned official "+name+" image...", flush=True)
        if core.run(["docker","image","inspect",image],check=False).returncode:
            core.run(["docker","pull",image],timeout=900)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--self-test",action="store_true",help="Generated real-API restore only; no private backup or account prompt.")
    args = parser.parse_args()
    os.umask(0o077)
    signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    stack = None
    try:
        print("Hustle local login and file-access recovery rehearsal v1.",flush=True)
        folder = Path.home()/"Hustle-Private-Backups"/core.SET_ID
        if not args.self_test:
            print("[1/7] Checking the verified native-restore report and encrypted backup...",flush=True)
            verify_report()
            core.verify_backup(folder)
        preflight()
        print("[2/7] Rehearsing a generated native restore, real login/refresh and Storage owner/other-user/public access...",flush=True)
        generated_contract()
        print("Generated real-API recovery contract passed; fixture containers removed.",flush=True)
        if args.self_test:
            print("SELF-TEST PASSED. No private backup or account was opened.")
            return 0
        stack = Stack()
        stack.start_database()
        password = getpass.getpass("Existing backup-encryption passphrase (hidden): ")
        require(16 <= len(password) and len(password.encode()) <= 1024 and not any(x in password for x in "\r\n\0"),
                "BACKUP_PASSPHRASE", "Use the separate existing backup-encryption passphrase.")
        reference = core.read_reference(folder,password)
        print("[3/7] Restoring a new offline database and verifying original metadata and file bytes...",flush=True)
        stack.database.restore(folder,password)
        core.compare_database(stack.database.catalog(),reference)
        require(core.restore_files(stack.database,folder/(core.SET_ID+"-storage_files.tar.gz.enc"),password,reference)==10,
                "LOCAL_RECOVERED_FILES", "The new copy did not recover all 10 files.")
        password = ""
        schema = private_sql(stack.database, SCHEMA_STATE)
        print("[4/7] Starting isolated APIs and reading all original files through the local Storage API...",flush=True)
        stack.services()
        require(private_sql(stack.database,SCHEMA_STATE)==schema,"LOCAL_SCHEMA_CHANGED","Starting the APIs changed the restored migration/policy contract. No complete result is reported.")
        objects = {x["id"]:x for x in reference["before"]["objects"]}
        for record in reference["file_hashes"]:
            stage_backend(stack,record,objects[record["object_id"]])
            assert_bytes(stack.request("storage",storage_path(record),token=stack.service_token,digest=True),record)
        core.compare_database(stack.database.catalog(),reference)
        print("[5/7] Checking your restored proof-owner account's real local login and session refresh...",flush=True)
        print("Use an existing email/password Hustle account that uploaded a private proof document.")
        print("Your details are sent only to the isolated copy. No password reset or email is attempted.")
        email = getpass.getpass("Proof-owner Hustle email (hidden): ").strip()
        user_id = account_info(stack,email)
        proofs = private_proofs(reference,user_id)
        require(proofs,"PRIVATE_PROOF_OWNER","That restored account has no backed-up private proof document. Use the account that uploaded a proof; no policy was changed.")
        password = getpass.getpass("That account's password at backup capture (hidden): ")
        token = stack.login(email,password,user_id)
        email = password = ""
        print("[6/7] Checking original proof-owner access and denial for an unrelated local account...",flush=True)
        stranger = stack.create_generated_account()
        require(stranger["id"] != user_id,"LOCAL_TEST_ACCOUNT","The unrelated local account was not distinct.")
        other_token = stack.login(stranger["email"],stranger["password"],stranger["id"])
        private_count,public_count = exercise_access(stack,reference,token,other_token,proofs)
        require(private_sql(stack.database,SCHEMA_STATE)==schema,"LOCAL_SCHEMA_CHANGED","A test changed the restored migration/policy contract.")
        require(core.fingerprint(stack.database.catalog())==core.fingerprint(reference["before"]),"LOCAL_METADATA_CHANGED","The API rehearsal changed original Storage metadata.")
        print("[7/7] Removing the temporary APIs, database, local accounts and recovered files...",flush=True)
        stack.cleanup()
        root = Path.home()/"Hustle-Restore-Checks"
        require(root.is_dir() and not root.is_symlink() and root.stat().st_uid==os.getuid(),"REPORT_FOLDER","The private report folder was not valid.")
        root.chmod(0o700)
        report = {"format":"hustle-local-access-recovery-v1","backup_set_id":core.SET_ID,"inventory_sha256":core.INVENTORY_SHA256,
                  "prior_restore_report_sha256":REPORT_SHA256,"checked_at":datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                  "test_images":{"database":core.IMAGE,"auth":AUTH_IMAGE,"storage":STORAGE_IMAGE},
                  "generated_real_api_restore_contract_passed":True,"restored_password_accounts_signed_in":1,
                  "restored_account_session_refresh_passed":True,"unrelated_identity":"generated_local_auth_account",
                  "unrelated_account_login_and_refresh_passed":True,"owner_private_proofs_byte_verified":private_count,
                  "other_user_and_anon_and_public_route_denied_for_same_proofs":True,"all_original_files_read_via_storage_api":10,
                  "public_original_files_byte_verified":public_count,"original_storage_metadata_and_policies_unchanged":True,
                  "auth_and_storage_migration_ledgers_unchanged":True,"temporary_containers_removed":True,
                  "production_accessed":False,"mfa_tested":False,"oauth_tested":False,"existing_sessions_recovered":False,
                  "all_restored_accounts_tested":False,"message_participant_access_tested":False,
                  "application_capability_flows_tested":False,"external_configuration_recovered":False,
                  "cross_service_atomic":False,"full_disaster_recovery_verified":False}
        output = root/(core.SET_ID+"-access-"+uuid.uuid4().hex[:8]+".json")
        raw = json.dumps(report,indent=2).encode()+b"\n"
        core.private_write(output,raw)
        print("\nLOCAL LOGIN AND PRIVATE-PROOF ACCESS REHEARSAL PASSED.")
        print("Restored account sign-in and session refresh: passed.")
        print("Original files read and hashed through Storage API: 10.")
        print("Private proof files checked for owner/other-user access: "+str(private_count))
        print("Temporary APIs, database, accounts and recovered files removed.")
        print("Report: "+str(output))
        print("Report SHA256: "+hashlib.sha256(raw).hexdigest())
        print("MFA/OAuth, all accounts, message participants, application flows, external configuration and full disaster recovery remain unverified.")
        return 0
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Test stopped. No complete access-recovery result is reported.",file=sys.stderr)
        return 130
    except RestoreError as error:
        print("\n["+error.code+"] "+error.message,file=sys.stderr)
        return 1
    except Exception as error:
        print("\n[LOCAL_ACCESS_ERROR] Test stopped ("+type(error).__name__+"). No private diagnostics were printed.",file=sys.stderr)
        return 1
    finally:
        if stack:
            try: stack.cleanup()
            except RestoreError as error:
                print("\n["+error.code+"] "+error.message,file=sys.stderr)
                return 1


if __name__=="__main__":
    sys.exit(main())
