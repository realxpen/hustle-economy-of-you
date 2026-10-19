#!/usr/bin/env bash
# Sourced by the guarded restore and the synthetic, unlinked local CLI test.
copy_local_storage() {
  local operation="$1" source="$2" destination="$3"
  local private_log="${RUNNER_TEMP:?}/storage-api-private.log"
  [[ "$operation" == upload || "$operation" == download ]] || return 2
  if supabase storage cp "$source" "$destination" --local --experimental >"$private_log" 2>&1; then
    return 0
  fi
  python3 "${GITHUB_WORKSPACE:?}/scripts/recovery/report_storage_error.py" "$private_log" "$operation"
  return 1
}
