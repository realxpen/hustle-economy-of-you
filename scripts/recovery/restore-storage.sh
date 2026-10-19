#!/usr/bin/env bash
# October 16 Hustle Storage bytes + bucket settings recovery smoke test.
# Writes ONLY to the explicitly named *fresh local Docker Supabase* instance.
# Does not restore the production storage.objects UUIDs / original owner fields;
# those are covered by a separate metadata-recovery verification step.
set -Eeuo pipefail
[[ "${GITHUB_ACTIONS:-}" == true && "${HUSTLE_ISOLATED_RECOVERY:-}" == true ]] || { echo "STOP: cloud recovery job guard missing" >&2; exit 2; }
[[ -z "${SUPABASE_ACCESS_TOKEN:-}" && -z "${DATABASE_URL:-}" ]] || { echo "STOP: production-capable environment variable present" >&2; exit 2; }
umask 077

LAB="${RUNNER_TEMP:?}/hustle-cloud-restore"
DB_CONTAINER='supabase_db_hustle-cloud-restore'
BACKUPS="${RUNNER_TEMP:?}/hustle-encrypted-downloads"
ARCHIVE="$BACKUPS/hustle-storage-20261016T121815Z.tar.gz.enc"
TMP=''
fail() { printf '\nSTOP: %s\n' "$*" >&2; exit 1; }
cleanup() {
  if [[ -n "$TMP" && -d "$TMP" ]]; then
    chmod -R u+rwX "$TMP" 2>/dev/null || true
    rm -rf -- "$TMP"
  fi
}
trap cleanup EXIT
source "${GITHUB_WORKSPACE:?}/scripts/recovery/storage-copy.sh"
source "${GITHUB_WORKSPACE:?}/scripts/recovery/storage-buckets.sh"

for cmd in docker supabase openssl sha256sum find cmp tar grep mktemp python3; do
  command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: $cmd"
done
[[ "$PWD" == "$LAB" ]] || fail "Run this script from the fresh local project: $LAB"
[[ -f "$LAB/supabase/config.toml" ]] || fail 'Fresh local project config is missing.'
[[ ! -s "$LAB/supabase/.temp/project-ref" ]] || fail 'STOP: This restore project has a nonempty remote project link.'
[[ -d "$BACKUPS" && ! -L "$BACKUPS" ]] || fail 'Private backup folder is missing or a symlink.'
[[ -s "$ARCHIVE" && -s "$ARCHIVE.sha256" ]] || fail 'The expected October 16 Storage archive or checksum is missing.'
docker ps --format '{{.Names}}' | grep -Fxq "$DB_CONTAINER" || fail 'The expected fresh local DB container is not running.'
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER")"
[[ "$IMAGE" == *supabase/postgres* ]] || fail "Unexpected database Docker image: $IMAGE"

DB_ID="$(local_storage_sql -Atqc "SELECT current_database() || ':' || current_user || ':' || current_setting('port')")"
[[ "$DB_ID" == postgres:postgres:* ]] || fail "Unexpected local DB identity: $DB_ID"
BEFORE="$(local_storage_sql -Atqc "SELECT (SELECT count(*) FROM public.\"User\")::text || ':' || (SELECT count(*) FROM auth.users)::text || ':' || (SELECT count(*) FROM storage.buckets)::text || ':' || (SELECT count(*) FROM storage.objects)::text")"
[[ "$BEFORE" == '6:4:0:0' ]] || fail "Expected 6 app users, 4 Auth users, and empty local Storage. Found app:auth:buckets:objects=$BEFORE. No writes made."

printf 'Checking fresh Storage archive SHA-256...\n'
(cd "$BACKUPS" && sha256sum -c "$(basename "$ARCHIVE").sha256") || fail 'Encrypted Storage archive checksum failed.'
TMP="$(mktemp -d "$LAB/.fresh-storage-restore-XXXXXXXX")"
chmod 700 "$TMP"
printf '\nDecrypting Storage backup into private temporary files...\n'
openssl enc -d -aes-256-cbc -pbkdf2 -iter 250000 -pass env:HUSTLE_RESTORE_STORAGE_PASSPHRASE -in "$ARCHIVE" \
  | python3 "$GITHUB_WORKSPACE/scripts/recovery/safe_extract.py" "$TMP" \
  || fail 'Storage archive failed to decrypt or unpack. No local Storage writes performed.'
[[ -f "$TMP/manifest.sha256" && -d "$TMP/storage-staging" ]] || fail 'Missing Storage backup manifest or staging directory.'
[[ -z "$(find "$TMP" -type l -print -quit)" ]] || fail 'Storage archive has a symlink. No local Storage writes performed.'
(
  cd "$TMP"
  sha256sum -c manifest.sha256 >/dev/null
) || fail 'A file inside the decrypted Storage archive failed its SHA-256 check.'
FILES="$(find "$TMP/storage-staging" -type f | wc -l | tr -d '[:space:]')"
[[ "$FILES" == '10' ]] || fail "Expected 10 files in Storage backup, found $FILES."
MANIFEST_COUNT="$(wc -l < "$TMP/manifest.sha256" | tr -d '[:space:]')"
[[ "$MANIFEST_COUNT" == '10' ]] || fail "Expected 10 manifest entries; found $MANIFEST_COUNT."

BUCKETS=(agent-proofs hustler-proofs message-attachments)
EXPECTED=(1 6 3)
SOURCES=()
for i in "${!BUCKETS[@]}"; do
  bucket="${BUCKETS[$i]}"
  dir="$TMP/storage-staging/$bucket"
  [[ -d "$dir" ]] || fail "Missing local source directory for $bucket."
  # Some Supabase CLI versions download the bucket into a nested same-name folder.
  # Accept that shape only when the outer folder contains no direct files.
  if [[ -d "$dir/$bucket" ]]; then
    direct="$(find "$dir" -maxdepth 1 -type f | wc -l | tr -d '[:space:]')"
    [[ "$direct" == 0 ]] || fail "Ambiguous nested Storage directory for $bucket."
    dir="$dir/$bucket"
  fi
  count="$(find "$dir" -type f | wc -l | tr -d '[:space:]')"
  [[ "$count" == "${EXPECTED[$i]}" ]] || fail "Expected ${EXPECTED[$i]} source files in $bucket; found $count."
  SOURCES+=("$dir")
done

printf '\nCreating four buckets ONLY in the fresh local database...\n'
create_local_storage_buckets || fail 'Local Storage buckets were not verified. No uploads attempted.'

printf '\nRestoring all 10 files through the LOCAL Supabase Storage API...\n'
for i in "${!BUCKETS[@]}"; do
  bucket="${BUCKETS[$i]}"
  dir="${SOURCES[$i]}"
  while IFS= read -r -d '' file; do
    rel="${file#"$dir"/}"
    [[ "$rel" != "$file" && -n "$rel" && "$rel" != /* && "$rel" != ../* && "$rel" != *'/../'* ]] \
      || fail 'Unsafe source relative file path.'
    copy_local_storage upload "$file" "ss:///$bucket/$rel" \
      || fail "Local Storage upload failed in bucket $bucket. Stop; do not rerun because partial local writes may exist."
  done < <(find "$dir" -type f -print0)
done

printf '\nVerifying local Storage bucket and object counts...\n'
TOTAL="$(local_storage_sql -Atqc 'SELECT count(*) FROM storage.objects')"
[[ "$TOTAL" == '10' ]] || fail "Expected 10 local Storage objects, got $TOTAL."
for i in "${!BUCKETS[@]}"; do
  bucket="${BUCKETS[$i]}"
  count="$(local_storage_sql -Atqc "SELECT count(*) FROM storage.objects WHERE bucket_id='$bucket'")"
  [[ "$count" == "${EXPECTED[$i]}" ]] || fail "Unexpected restored object count in $bucket: $count"
done

printf '\nReading every object BACK from LOCAL Storage and byte-comparing...\n'
for i in "${!BUCKETS[@]}"; do
  bucket="${BUCKETS[$i]}"
  dir="${SOURCES[$i]}"
  while IFS= read -r -d '' file; do
    rel="${file#"$dir"/}"
    recovered="$TMP/readback/$bucket/$rel"
    mkdir -p -- "$(dirname -- "$recovered")"
    copy_local_storage download "ss:///$bucket/$rel" "$recovered" \
      || fail "Unable to read a LOCAL object back from $bucket."
    cmp -s -- "$file" "$recovered" || fail "LOCAL object bytes mismatch in $bucket."
  done < <(find "$dir" -type f -print0)
done

printf '\nFRESH LOCAL STORAGE BYTE RECOVERY PASSED: 4 buckets, 10 objects, all object bytes matched.\n'
local_storage_sql -c "SELECT bucket_id, count(*) AS objects FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;"
printf '\nProduction original object UUIDs, owner fields, timestamps, Storage RLS and real sign-in remain unverified.\n'
printf 'The separate encrypted Storage metadata backup remains unchanged.\n'
