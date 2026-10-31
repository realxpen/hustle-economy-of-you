-- UX046: all source Prisma migrations have finished. Restrict the old
-- Supabase-oriented trusted API policy principal to NOLOGIN, then grant
-- membership to our private, dedicated preview API role only.
DO $ux046$
BEGIN
  IF current_database() <> 'hustle_payment_preview' OR
     current_user <> 'hustle_payment_preview_owner' OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hustle_api') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hustle_payment_preview_api') OR
     (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public') < 30 OR
     (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='payment_auth') <> 5 THEN
    RAISE EXCEPTION 'REFUSED: preview schema incomplete; no permission handoff';
  END IF;
END $ux046$;
ALTER ROLE hustle_api NOLOGIN;
GRANT hustle_api TO hustle_payment_preview_api;
GRANT USAGE ON SCHEMA public, payment_auth TO hustle_payment_preview_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA payment_auth TO hustle_payment_preview_api;
ALTER DEFAULT PRIVILEGES FOR ROLE hustle_payment_preview_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hustle_api;
ALTER DEFAULT PRIVILEGES FOR ROLE hustle_payment_preview_owner IN SCHEMA payment_auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hustle_payment_preview_api;

DO $ux046$
BEGIN
 IF NOT pg_has_role('hustle_payment_preview_api','hustle_api','member') OR
    NOT has_table_privilege('hustle_payment_preview_api','public."User"','SELECT') OR
    NOT has_table_privilege('hustle_payment_preview_api','payment_auth."user"','SELECT') OR
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon' AND rolcanlogin) OR
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated' AND rolcanlogin) OR
    EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hustle_api' AND rolcanlogin)
 THEN
   RAISE EXCEPTION 'REFUSED: dedicated preview role access/NOLOGIN checks failed';
 END IF;
END $ux046$;
