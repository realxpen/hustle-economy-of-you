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
