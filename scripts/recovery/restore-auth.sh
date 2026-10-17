#!/usr/bin/env bash
# Hustle Auth USERS + IDENTITIES fresh-archive restore smoke test (2026-10-16).
# Only writes to local Docker container supabase_db_hustle-restore-fresh-20261016.
# Does NOT restore auth internal migrations, sessions, MFA, tokens or Storage.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${HUSTLE_ISOLATED_RECOVERY:-}" == true ]] || { echo "STOP: cloud recovery job guard missing" >&2; exit 2; }
[[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -z "${DATABASE_URL:-}" ]] || { echo "STOP: production-capable environment variable present" >&2; exit 2; }
umask 077

LAB="${RUNNER_TEMP:?}/hustle-cloud-restore"
CONTAINER="supabase_db_hustle-cloud-restore"
ROOT="${RUNNER_TEMP:?}/hustle-encrypted-downloads"
WORK=""
fail() { printf '\nSTOP: %s\n' "$*" >&2; exit 1; }
cleanup() { [[ -z "$WORK" || ! -d "$WORK" ]] || rm -rf -- "$WORK"; }
trap cleanup EXIT

for program in docker openssl gzip sha256sum mktemp awk grep find; do
  command -v "$program" >/dev/null || fail "Missing program: $program"
done
[[ -d "$ROOT" && ! -L "$ROOT" ]] || fail "The backup directory is missing or is a symlink."
[[ -f "$LAB/supabase/config.toml" ]] || fail "The fresh local Hustle restore lab is missing."
[[ "$PWD" == "$LAB" ]] || fail "Run from the fresh restore project directory: $LAB"
[[ ! -s "$LAB/supabase/.temp/project-ref" ]] || fail "Local lab has a remote Supabase link; stopping."
docker ps --format '{{.Names}}' | grep -Fxq "$CONTAINER" || fail "The expected local database container is not running."
IMAGE="$(docker inspect --format '{{.Config.Image}}' "$CONTAINER")"
[[ "$IMAGE" == *supabase/postgres* ]] || fail "Unexpected local DB image; refusing to continue."
TARGET="$(docker exec "$CONTAINER" psql -X -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c "SELECT current_database() || ':' || current_user || ':' || current_setting('port')")"
[[ "$TARGET" == postgres:postgres:* ]] || fail "Unexpected database target."

# Local database must not contain accounts or identities. Existing app tables stay untouched.
BEFORE="$(docker exec "$CONTAINER" psql -X -U postgres -d postgres -Atq -v ON_ERROR_STOP=1 -c \
  "SELECT (SELECT count(*) FROM auth.users)::text || ':' || (SELECT count(*) FROM auth.identities)::text;")"
[[ "$BEFORE" == '0:0' ]] || fail "Local Auth is not empty (counts: $BEFORE). Refusing to overwrite data."

# Pin exact October 16 archive. Older backups are intentionally preserved.
ARCHIVE="$ROOT/hustle-auth-20261016T120049Z.sql.gz.enc"
[[ -s "$ARCHIVE" && -s "$ARCHIVE.sha256" ]] || fail "Expected October 16 Auth archive/checksum missing."
(cd "$ROOT" && sha256sum -c "$(basename "$ARCHIVE").sha256") || fail "Encrypted Auth archive checksum failed."

WORK="$(mktemp -d "$LAB/.auth-restore-XXXXXXXX")"
chmod 700 "$WORK"
printf '\nDecrypting Auth dump locally into private temporary storage...\n'
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -pass env:HUSTLE_RESTORE_AUTH_PASSPHRASE -in "$ARCHIVE" | gzip -dc > "$WORK/auth-all.sql" || fail "Auth archive decryption failed."

# A full Auth dump also includes internal auth.schema_migrations etc., which
# cannot safely be replayed on top of a versioned Supabase local installation.
# Select only account and identity COPY blocks, in dependency order. No rows
# are printed; sensitive records stay in the private staging directory.
awk -v users="$WORK/users.sql" -v identities="$WORK/identities.sql" '
  /^COPY auth[.]users[[:space:]]*[(]/ { target=users; copies_u++; print > target; next }
  /^COPY auth[.]identities[[:space:]]*[(]/ { target=identities; copies_i++; print > target; next }
  /^COPY / { target="discard"; next }
  target!="" {
    if (target!="discard") print > target
    if ($0=="\\.") target=""
  }
  END {
    if (target!="" || copies_u!=1 || copies_i!=1) {
      print "Auth dump did not contain exactly one complete users and identities COPY block" > "/dev/stderr"
      exit 2
    }
  }
' "$WORK/auth-all.sql" || fail "Could not extract account + identity data safely."
[[ -s "$WORK/users.sql" && -s "$WORK/identities.sql" ]] || fail "Extracted Auth data files are empty."

printf 'Restoring fresh Auth users + identities ONLY into the isolated local Docker database...\n'
# --single-transaction and ON_ERROR_STOP ensure no partial committed import.
# No remote connection strings or Supabase CLI linked project actions are used.
{
  printf 'SET CONSTRAINTS ALL DEFERRED;\n'
  cat "$WORK/users.sql"
  cat "$WORK/identities.sql"
  cat <<'SQL'
DO $verify$
DECLARE n_users bigint; n_id bigint; n_orphans bigint;
BEGIN
  SELECT count(*) INTO n_users FROM auth.users;
  SELECT count(*) INTO n_id FROM auth.identities;
  SELECT count(*) INTO n_orphans FROM auth.identities i LEFT JOIN auth.users u ON u.id=i.user_id WHERE u.id IS NULL;
  IF n_users<>4 THEN RAISE EXCEPTION 'Expected 4 restored Auth users, got %', n_users; END IF;
  IF n_id<>4 THEN RAISE EXCEPTION 'Expected 4 restored Auth identities, got %', n_id; END IF;
  IF n_orphans<>0 THEN RAISE EXCEPTION 'Restored identities contain % orphan references', n_orphans; END IF;
END $verify$;
SQL
} | docker exec -i "$CONTAINER" psql -X -U postgres -d postgres -q --single-transaction -v ON_ERROR_STOP=1 -f /dev/stdin > "${RUNNER_TEMP:?}/auth-import-private.log" 2>&1 \
    || fail "Local Auth import failed and its transaction was rolled back."

printf '\nFRESH LOCAL AUTH USERS + IDENTITIES RESTORE PASSED (4 users, 4 identities).\n'
docker exec "$CONTAINER" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c \
  'SELECT (SELECT count(*) FROM auth.users) AS auth_users, (SELECT count(*) FROM auth.identities) AS auth_identities;'
printf '\nNot a full Auth disaster-recovery test: sessions, MFA, tokens, internal schema migrations and sign-in still need separate testing.\n'
