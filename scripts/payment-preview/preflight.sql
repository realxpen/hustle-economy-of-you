-- UX046: no writes. Fail before migrations unless this is the new, clean
-- payment-preview PG17 database under its own dedicated migration owner.
DO $ux046$
BEGIN
  IF current_database() <> 'hustle_payment_preview' OR
     current_user <> 'hustle_payment_preview_owner' OR
     current_setting('server_version_num')::integer / 10000 <> 17 OR
     NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='payment_auth') OR
     NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hustle_payment_preview_api') OR
     EXISTS (SELECT 1 FROM pg_catalog.pg_tables
             WHERE schemaname IN ('public','payment_auth','storage')) OR
     NOT has_schema_privilege(current_user,'public','CREATE') OR
     NOT has_schema_privilege(current_user,'payment_auth','CREATE') THEN
    RAISE EXCEPTION 'REFUSED: migration target must be the empty independent Neon PG17 payment-preview database and authorized owner';
  END IF;
END $ux046$;
