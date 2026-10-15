-- READ-ONLY. Can run in Supabase SQL Editor before and after controlled deployment.
-- Does not touch live user data except aggregate table counts and migration metadata.
-- Does not reconcile, stamp or apply any migration.
SELECT
  (SELECT count(*) FROM public."_prisma_migrations"
   WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS prisma_applied,
  (SELECT count(*) FROM supabase_migrations.schema_migrations) AS supabase_applied,
  (SELECT pg_size_pretty(pg_database_size(current_database()))) AS total_database_size,
  (SELECT count(*) FROM public."User") AS user_count,
  (SELECT count(*) FROM public."Service") AS service_count,
  (SELECT count(*) FROM public."Booking") AS booking_count,
  (SELECT count(*) FROM public."Notification") AS notification_count,
  to_regclass('public."AgentApplication"') IS NOT NULL AS agent_foundation_exists,
  to_regclass('public."AgentRelationship"') IS NOT NULL AS agent_relationship_exists,
  to_regclass('public."AgentAssistedRegistration"') IS NOT NULL AS assisted_onboarding_exists,
  to_regclass('public."MarketplaceCase"') IS NOT NULL AS marketplace_case_exists,
  to_regclass('public."EnforcementAppeal"') IS NOT NULL AS appeals_exist,
  to_regclass('public."FinancialDispatchCommand"') IS NOT NULL AS financial_dispatch_exists,
  to_regclass('public."MoniflowSandboxReceiptObservation"') IS NOT NULL AS isolated_receipt_exists,
  to_regclass('public."BookingScheduleRevision"') IS NOT NULL AS flowtime_revision_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
     AND table_name='Service' AND column_name='bookingMode') AS flowtime_service_policy_exists,
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
     AND table_name='Booking' AND column_name='actualStartedAt') AS flowtime_work_tracking_exists;

SELECT migration_name AS prisma_recorded_migration
FROM public."_prisma_migrations"
WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
ORDER BY migration_name;

SELECT version,name FROM supabase_migrations.schema_migrations ORDER BY version;

SELECT c.relname AS object_name, c.relrowsecurity AS rls_enabled,
  has_table_privilege('hustle_api',c.oid,'SELECT') AS api_can_select,
  has_table_privilege('hustle_api',c.oid,'INSERT') AS api_can_insert,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_can_select,
  has_table_privilege('authenticated',c.oid,'SELECT') AS authenticated_can_select
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
  ('Booking','Service','Notification','BookingScheduleRevision')
ORDER BY c.relname;

SELECT tablename,policyname,cmd,roles
FROM pg_policies WHERE schemaname='public'
AND tablename IN ('BookingScheduleRevision')
ORDER BY tablename,policyname;
