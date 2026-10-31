-- UX046: guarded COMPATIBILITY BOOTSTRAP for a NEW isolated payment-preview
-- Neon project only. This is NOT real Supabase auth/storage. These objects
-- exist solely to satisfy the historical Hustle Prisma migration DDL.
-- Never run this against staging/production, or treat it as media storage.
DO $ux046$
BEGIN
  IF current_database() <> 'hustle_payment_preview' OR
     current_user <> 'hustle_payment_preview_owner' OR
     current_setting('server_version_num')::integer / 10000 <> 17 OR
     NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='payment_auth') OR
     EXISTS(SELECT 1 FROM pg_catalog.pg_tables
            WHERE schemaname IN ('public','payment_auth')) THEN
    RAISE EXCEPTION 'REFUSED: UX046 requires an empty dedicated PG17 owner-managed payment-preview database';
  END IF;
END $ux046$;

DO $ux046$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END $ux046$;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
-- Never authenticate anyone with these dummy functions. The isolated preview
-- uses Better Auth in payment_auth; no Supabase browser/storage service exists.
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE OR REPLACE FUNCTION storage.foldername(path text) RETURNS text[]
  LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN path IS NULL THEN ARRAY[]::text[]
      ELSE string_to_array(path, '/') END
  $$;
CREATE TABLE IF NOT EXISTS storage.buckets(
  id text PRIMARY KEY, name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[]
);
CREATE TABLE IF NOT EXISTS storage.objects(
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA auth, storage FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA storage FROM PUBLIC;
