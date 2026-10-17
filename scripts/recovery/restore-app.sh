#!/usr/bin/env bash
# Hustle local APPLICATION snapshot restore, Oct 16 2026.
# ONLY uses the local Docker container created by `supabase start` in
# ~/hustle-restore-fresh-20261016. Never uses linked credentials or a remote DB URI.
# Skips reserved Supabase roles, Supabase-managed Auth/Storage table data.
# Auth users, Storage objects and bucket metadata need their own recovery tests.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${HUSTLE_ISOLATED_RECOVERY:-}" == true ]] || { echo "STOP: cloud recovery job guard missing" >&2; exit 2; }
[[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -z "${DATABASE_URL:-}" ]] || { echo "STOP: production-capable environment variable present" >&2; exit 2; }
umask 077

LAB="${RUNNER_TEMP:?}/hustle-cloud-restore"
CONTAINER="supabase_db_hustle-cloud-restore"
ROOT="${RUNNER_TEMP:?}/hustle-encrypted-downloads"
ARCHIVE="$ROOT/hustle-appdb-20261016T115915Z.tar.gz.enc"
WORK=""

abort() { printf '\nSTOP: %s\n' "$*" >&2; exit 1; }
cleanup() { if [[ -n "$WORK" && -d "$WORK" ]]; then rm -rf -- "$WORK"; fi; }
trap cleanup EXIT

for cmd in docker openssl tar sha256sum mktemp grep awk; do
  command -v "$cmd" >/dev/null || abort "Missing program: $cmd"
done
[[ -f "$LAB/supabase/config.toml" ]] || abort "Local restore lab was not found."
[[ ! -s "$LAB/supabase/.temp/project-ref" ]] || abort "Restore lab is linked to a remote Supabase project."
docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER" || abort "Expected local DB container is not running: $CONTAINER"
IMAGE="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER")"
[[ "$IMAGE" == *supabase/postgres* ]] || abort "Unexpected local DB image: $IMAGE"
[[ -s "$ARCHIVE" && -s "$ARCHIVE.sha256" ]] || abort "App archive or checksum missing."

# Check *inside* the expected local container; no host/port/URI can redirect it.
TARGET="$(docker exec "$CONTAINER" psql -X -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c \
  "SELECT current_database() || ':' || current_user || ':' || current_setting('port')")"
[[ "$TARGET" == postgres:postgres:* ]] || abort "Unexpected local target: $TARGET"

# Version 2 ran with --single-transaction; its failed import should have rolled back.
EXISTING="$(docker exec "$CONTAINER" psql -X -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('User','Service','Booking')")"
[[ "$EXISTING" == 0 ]] || abort "The local DB already has $EXISTING core Hustle tables. Do not run another import."
# This fresh restore starts from an empty local Auth/Storage setup; enforce it.
MANAGED="$(docker exec "$CONTAINER" psql -X -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM auth.users)::text || ':' || (SELECT count(*) FROM storage.buckets)::text || ':' || (SELECT count(*) FROM storage.objects)::text;")"
[[ "$MANAGED" == '0:0:0' ]] || abort "Fresh local managed data is not empty (auth:buckets:objects=$MANAGED)."

(cd "$ROOT" && sha256sum -c "$(basename "$ARCHIVE").sha256")
WORK="$(mktemp -d "$LAB/.restore-test-v3-XXXXXXXX")"
chmod 700 "$WORK"
printf '\nDecrypting verified app snapshot into a temporary private directory...\n'
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -pass env:HUSTLE_RESTORE_APP_PASSPHRASE -in "$ARCHIVE" | python3 "$GITHUB_WORKSPACE/scripts/recovery/safe_extract.py" "$WORK"
[[ -s "$WORK/schema.sql" && -s "$WORK/data.sql" ]] || abort "Missing application schema or data in archive."

# The CLI's default data-only dump can also contain Supabase-managed storage
# table COPY blocks (including storage.buckets_vectors). They do not belong in
# an app-only restore, and local postgres cannot always write to those tables.
# Preserve original encrypted archive unchanged. Filter only import stream.
awk '
  BEGIN { managed_copy = 0; excluded = 0; managed_sequence = 0 }
  /^COPY (auth|storage)[.]/ || /^COPY "(auth|storage)"[.]/ {
    if (managed_copy) { print "Nested COPY while filtering" > "/dev/stderr"; exit 3 }
    managed_copy = 1; excluded++; next
  }
  managed_copy {
    if ($0 == "\\.") managed_copy = 0
    next
  }
  /^SELECT pg_catalog[.]setval[(]/ && (index($0, "storage.") > 0 || index($0, "auth.") > 0) {
    managed_sequence++; next
  }
  { print }
  END {
    if (managed_copy) { print "Unterminated managed COPY block" > "/dev/stderr"; exit 3 }
    printf "Skipped %d managed Auth/Storage COPY blocks and %d managed sequence updates.\n", excluded, managed_sequence > "/dev/stderr"
  }
' "$WORK/data.sql" > "$WORK/app-data.sql"

printf '\nImporting schema + APPLICATION data only into local container %s...\n' "$CONTAINER"
printf 'Skipping roles.sql and managed Auth/Storage table data.\n'
{
  cat <<'SQL'
-- Local-only placeholder role for schema policies; never modify reserved roles.
DO $local$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hustle_api') THEN
    CREATE ROLE hustle_api NOLOGIN;
  END IF;
END $local$;
SQL
  cat "$WORK/schema.sql"
  printf '\nSET CONSTRAINTS ALL DEFERRED;\n'
  cat "$WORK/app-data.sql"
  cat <<'SQL'
-- Prove all four application counts before committing the restore.
DO $verify$
DECLARE n_users bigint; n_services bigint; n_bookings bigint; n_notifications bigint;
BEGIN
  SELECT count(*) INTO n_users FROM public."User";
  SELECT count(*) INTO n_services FROM public."Service";
  SELECT count(*) INTO n_bookings FROM public."Booking";
  SELECT count(*) INTO n_notifications FROM public."Notification";
  IF (n_users, n_services, n_bookings, n_notifications) IS DISTINCT FROM (6::bigint,2::bigint,8::bigint,17::bigint) THEN
    RAISE EXCEPTION 'Unexpected application row counts: users %, services %, bookings %, notifications %',
      n_users, n_services, n_bookings, n_notifications;
  END IF;
END $verify$;
SQL
} | docker exec -i "$CONTAINER" psql -X -U postgres -d postgres \
       --single-transaction -v ON_ERROR_STOP=1 -f /dev/stdin > "${RUNNER_TEMP:?}/app-import-private.log" 2>&1 || abort "Local application import failed (private SQL log withheld)"

printf '\nLOCAL APPLICATION RESTORE TRANSACTION COMPLETED.\n'
printf 'Checking local Hustle core row counts:\n'
docker exec "$CONTAINER" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  'SELECT (SELECT count(*) FROM public."User") AS users,
          (SELECT count(*) FROM public."Service") AS services,
          (SELECT count(*) FROM public."Booking") AS bookings,
          (SELECT count(*) FROM public."Notification") AS notifications;'
printf '\nThis proves only the application data restore, NOT Auth/Storage recovery.\n'
