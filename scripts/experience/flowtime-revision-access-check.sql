-- Read-only verification. Run ONLY on a disposable CI Postgres database.
-- Ensures FlowTime extension recording is actually permitted for the API role.
DO $flowtime$
BEGIN
  IF to_regclass('public."BookingScheduleRevision"') IS NULL THEN
    RAISE EXCEPTION 'FlowTime schedule revision table is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='BookingScheduleRevision' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'FlowTime schedule revisions must use row-level security';
  END IF;
  IF NOT has_table_privilege('hustle_api','public."BookingScheduleRevision"','INSERT,SELECT') THEN
    RAISE EXCEPTION 'FlowTime API role cannot create and read revisions';
  END IF;
  IF has_table_privilege('anon','public."BookingScheduleRevision"','SELECT')
    OR has_table_privilege('anon','public."BookingScheduleRevision"','INSERT')
    OR has_table_privilege('authenticated','public."BookingScheduleRevision"','SELECT')
    OR has_table_privilege('authenticated','public."BookingScheduleRevision"','INSERT') THEN
    RAISE EXCEPTION 'Browser-facing roles must have no direct schedule revision access';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='BookingScheduleRevision'
      AND policyname='hustle_api_flowtime_revision_read'
      AND cmd='SELECT' AND 'hustle_api'=ANY(roles)
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public'
      AND tablename='BookingScheduleRevision'
      AND policyname='hustle_api_flowtime_revision_insert'
      AND cmd='INSERT' AND 'hustle_api'=ANY(roles)
  ) THEN
    RAISE EXCEPTION 'FlowTime API-only row policies are missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Service' AND column_name='bookingMode'
  ) THEN
    RAISE EXCEPTION 'FlowTime Service policy columns are missing';
  END IF;
END $flowtime$;

SELECT 'FlowTime revision access and Service policy passed' AS result;
