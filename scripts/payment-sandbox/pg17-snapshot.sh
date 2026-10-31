#!/usr/bin/env bash
# UX040: use the PostgreSQL 17 client shipped in the same exact image
# as the throwaway GitHub Actions database. Never rely on ubuntu-latest
# pg_dump/pg_restore versions, which can change independently.
#
# Only use with disposable TEST db. This helper never accepts a database
# address or credentials supplied by a caller.
set -euo pipefail

ux040_pg17_check() {
  local allowed_url='postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public'
  if [[ "${DATABASE_URL:-}" != "$allowed_url" ]]; then
    echo 'REFUSED: UX040 archive tools require the exact disposable localhost database.' >&2
    return 1
  fi
  local version
  version="$(PGPASSWORD=sandbox_only psql -At -h 127.0.0.1 -p 55439 -U postgres -d hustle_payment_sandbox -c 'SHOW server_version_num')"
  if [[ "$version" != 17* ]]; then
    echo 'REFUSED: UX040 archive tools require PostgreSQL 17 server.' >&2
    return 1
  fi
  # Version checks deliberately run *inside* the pinned container. Host runner
  # binaries can be 16, 17, 18 or different versions from the server.
  docker run --rm postgres:17-alpine pg_dump --version | grep -Fq ') 17.'
  docker run --rm postgres:17-alpine pg_restore --version | grep -Fq ') 17.'
  echo 'PASS: isolated PostgreSQL 17 server and pinned PostgreSQL 17 archive tools.'
}

ux040_pg17_dump() {
  local archive="${1:?archive path required}"
  [[ -f "$archive" ]] && { echo 'REFUSED: snapshot already exists.' >&2; return 1; }
  ux040_pg17_check
  # The stdout of pg_dump is a binary custom-format archive. It contains only
  # synthetic CI test data and is never sent to a remote database.
  docker run --rm --network host -e PGPASSWORD=sandbox_only postgres:17-alpine \
    pg_dump -Fc --no-owner --no-acl \
      -h 127.0.0.1 -p 55439 -U postgres -d hustle_payment_sandbox > "$archive"
  test -s "$archive"
}

ux040_pg17_restore() {
  local archive="${1:?archive path required}"
  test -s "$archive"
  ux040_pg17_check
  # Prisma migrations create hustle_api LOGIN during PREPARE, but roles are
  # cluster globals and pg_dump does not include CREATE ROLE. VERIFY starts
  # with a new disposable Postgres service, skips migrations and must recreate
  # the exact trusted API policy principal BEFORE restoring archived policies.
  # It has NOLOGIN in the replay, because no application connection needs this
  # role and synthetic snapshot restoration must not enable extra login paths.
  # This is strictly behind the fixed localhost URL/PG17 guard above.
  PGPASSWORD=sandbox_only psql -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p 55439 -U postgres -d hustle_payment_sandbox <<'UX040_ROLE_SQL'
DO $ux040$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hustle_api') THEN
    CREATE ROLE hustle_api NOLOGIN;
  END IF;
END
$ux040$;
UX040_ROLE_SQL
  # Binary archive streams through stdin: no volume mount, extra network,
  # GitHub runner client version, or external service needed.
  docker run --rm --network host -i -e PGPASSWORD=sandbox_only postgres:17-alpine \
    pg_restore --exit-on-error --clean --if-exists --no-owner --no-acl \
      -h 127.0.0.1 -p 55439 -U postgres -d hustle_payment_sandbox < "$archive"
}
