-- Disposable PostgreSQL bootstrap ONLY.
-- Creates the two Supabase API roles referenced by Hustle RLS migrations.
-- Never run this against a hosted/production database.
DO $$
BEGIN
  IF current_database() <> 'hustle_payment_sandbox' THEN
    RAISE EXCEPTION 'Refusing to run sandbox role bootstrap on %', current_database();
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- Supabase Storage is a managed subsystem not bundled in vanilla PostgreSQL.
-- These minimal *schema-only* fixtures allow Hustle's storage RLS migrations
-- to execute without ever connecting to or simulating production file storage.
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;

CREATE OR REPLACE FUNCTION storage.foldername(path text) RETURNS text[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN path IS NULL THEN ARRAY[]::text[]
    ELSE string_to_array(path, '/')
  END
$$;

CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean NOT NULL DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

CREATE TABLE IF NOT EXISTS storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
