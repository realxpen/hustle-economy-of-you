#!/usr/bin/env bash
# Shared only by the guarded recovery and synthetic local Storage test.
local_storage_sql() {
  case "${DB_CONTAINER:-}" in
    supabase_db_hustle-cloud-restore|supabase_db_hustle-storage-cli-contract) ;;
    *) printf 'STOP: unexpected local Storage database container.\n' >&2; return 2 ;;
  esac
  # -i forwards heredocs/pipes to psql inside the disposable container.
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -X -v ON_ERROR_STOP=1 "$@"
}

create_local_storage_buckets() {
  # Preserve the audited visibility, size and MIME restrictions.
  if ! local_storage_sql --single-transaction -f /dev/stdin <<'SQL'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
 ('agent-proofs', 'agent-proofs', false, 10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
 ('hustler-proofs', 'hustler-proofs', false, 10485760,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
 ('message-attachments', 'message-attachments', false, 26214400,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf',
        'text/plain','text/csv','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip']),
 ('story-media', 'story-media', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']);
DO $$ BEGIN
  IF (SELECT count(*) FROM storage.buckets) <> 4 THEN
    RAISE EXCEPTION 'Expected precisely four local Storage buckets';
  END IF;
END $$;
SQL
  then
    printf 'STOP: local Storage bucket creation failed.\n' >&2
    return 1
  fi

  # Check in a separate request: an empty stdin can otherwise make psql exit 0
  # without executing either the INSERT or its in-transaction assertion.
  local state
  state="$(local_storage_sql -Atqc "SELECT
    (SELECT count(*) FROM storage.buckets)::text || ':' ||
    (SELECT count(*) FROM storage.buckets
      WHERE id = name AND id IN ('agent-proofs', 'hustler-proofs', 'message-attachments', 'story-media'))::text || ':' ||
    (SELECT count(*) FROM storage.objects)::text")" || return 1
  if [[ "$state" != '4:4:0' ]]; then
    printf 'STOP: expected four named local Storage buckets and zero objects before uploads.\n' >&2
    return 1
  fi
  printf 'PASS: four named local Storage buckets exist; zero objects before uploads.\n'
}
