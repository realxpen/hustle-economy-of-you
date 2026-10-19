#!/usr/bin/env bash
# Public synthetic fixtures only: no backups, Drive access or user credentials.
set -Eeuo pipefail
umask 077
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'STOP: GitHub runner required' >&2; exit 2; }
[[ -z "${DATABASE_URL:-}" && -z "${SUPABASE_ACCESS_TOKEN:-}" && -z "${SUPABASE_AUTH_SERVICE_ROLE_KEY:-}" ]] \
  || { echo 'STOP: external credentials present' >&2; exit 2; }
LAB="${RUNNER_TEMP:?}/hustle-storage-cli-contract"
DB_CONTAINER='supabase_db_hustle-storage-cli-contract'
source "${GITHUB_WORKSPACE:?}/scripts/recovery/storage-copy.sh"
source "${GITHUB_WORKSPACE:?}/scripts/recovery/storage-buckets.sh"

cleanup() {
  if [[ -f "$LAB/supabase/config.toml" ]]; then
    (cd "$LAB" && supabase stop --no-backup) >/dev/null 2>&1 || true
  fi
  rm -f -- "${RUNNER_TEMP:?}/storage-api-private.log" "${RUNNER_TEMP:?}/synthetic-start-private.log"
}
trap cleanup EXIT

supabase --version
supabase storage --help
supabase storage cp --help
mkdir "$LAB"
cd "$LAB"
supabase init
[[ ! -s supabase/.temp/project-ref ]]
if ! supabase start >"$RUNNER_TEMP/synthetic-start-private.log" 2>&1; then
  echo 'STOP: synthetic local stack failed to start; private startup output withheld' >&2
  exit 1
fi
docker ps --format '{{.Names}}' | grep -Fxq "$DB_CONTAINER"
IMAGE="$(docker inspect -f '{{.Config.Image}}' "$DB_CONTAINER")"
[[ "$IMAGE" == *supabase/postgres* ]]
create_local_storage_buckets
mkdir fixtures readback
python3 - <<'PY'
import base64
from pathlib import Path
Path('fixtures/proof.pdf').write_bytes(b'%PDF-1.4\n% Synthetic Hustle Storage contract fixture only.\n%%EOF\n')
Path('fixtures/proof.png').write_bytes(base64.b64decode(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfWQAAAAASUVORK5CYII='))
PY
for extension in pdf png; do
  if ! copy_local_storage upload "$LAB/fixtures/proof.$extension" "ss:///agent-proofs/contracts/proof.$extension"; then
    # This log contains only the generated fixtures and the disposable local stack.
    # Redact any generated token before displaying diagnostic text.
    python3 - <<'PY'
import os,re
from pathlib import Path
text=(Path(os.environ['RUNNER_TEMP'])/'storage-api-private.log').read_text(errors='replace')[:8192]
text=re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[local JWT withheld]', text)
text=re.sub(r'sb_(?:secret|publishable)_[A-Za-z0-9_-]+', '[local API key withheld]', text)
print('Synthetic-only CLI diagnostic:', text)
PY
    exit 1
  fi
  copy_local_storage download "ss:///agent-proofs/contracts/proof.$extension" "$LAB/readback/proof.$extension"
  cmp -- "$LAB/fixtures/proof.$extension" "$LAB/readback/proof.$extension"
done
COUNT="$(local_storage_sql -Atqc 'SELECT count(*) FROM storage.objects')"
[[ "$COUNT" == 2 ]]
echo 'PASS: synthetic PDF/PNG uploads and byte-for-byte local readbacks.'
