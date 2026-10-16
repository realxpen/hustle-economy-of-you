-- Isolated CI PostgreSQL ONLY. Read-only schema/ACL assertions plus query planning.
-- Never run this test against production; requires CI's throwaway database name.
DO $casework_check$
DECLARE
  t text;
  perm text;
  rec record;
BEGIN
  IF current_database() <> 'hustle_payment_sandbox' THEN
    RAISE EXCEPTION 'Refusing casework permission test in database %', current_database();
  END IF;

  FOREACH t IN ARRAY ARRAY['MarketplaceCase','MarketplaceCaseNote'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'Missing casework table %', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'RLS disabled on casework table %', t;
    END IF;
    FOREACH perm IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      IF has_table_privilege('anon',format('public.%I',t),perm)
        OR has_table_privilege('authenticated',format('public.%I',t),perm) THEN
        RAISE EXCEPTION 'Browser roles have % permission on %', perm, t;
      END IF;
    END LOOP;
  END LOOP;

  FOR rec IN SELECT * FROM (VALUES
    ('MarketplaceCase','SELECT'),('MarketplaceCase','INSERT'),('MarketplaceCase','UPDATE'),
    ('MarketplaceCaseNote','SELECT'),('MarketplaceCaseNote','INSERT')
  ) AS required_permission(table_name, privilege) LOOP
    IF NOT has_table_privilege('hustle_api',format('public.%I',rec.table_name),rec.privilege) THEN
      RAISE EXCEPTION 'hustle_api lacks % on %',rec.privilege,rec.table_name;
    END IF;
  END LOOP;
  IF has_table_privilege('hustle_api','public."MarketplaceCase"','DELETE')
    OR has_table_privilege('hustle_api','public."MarketplaceCaseNote"','UPDATE')
    OR has_table_privilege('hustle_api','public."MarketplaceCaseNote"','DELETE') THEN
    RAISE EXCEPTION 'Casework role has overly broad privileges';
  END IF;

  FOR rec IN SELECT * FROM (VALUES
    ('MarketplaceCase','hustle_api_marketplace_case_select','SELECT','true',NULL::text),
    ('MarketplaceCase','hustle_api_marketplace_case_insert','INSERT',NULL::text,'true'),
    ('MarketplaceCase','hustle_api_marketplace_case_update','UPDATE','true','true'),
    ('MarketplaceCaseNote','hustle_api_marketplace_case_note_select','SELECT','true',NULL::text),
    ('MarketplaceCaseNote','hustle_api_marketplace_case_note_insert','INSERT',NULL::text,'true')
  ) AS expected_policy(table_name,policy_name,command,using_clause,check_clause) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname='public' AND p.tablename=rec.table_name
        AND p.policyname=rec.policy_name AND p.cmd=rec.command
        AND 'hustle_api'=ANY(p.roles)
        AND p.qual IS NOT DISTINCT FROM rec.using_clause
        AND p.with_check IS NOT DISTINCT FROM rec.check_clause
    ) THEN
      RAISE EXCEPTION 'Incorrect casework policy % on %',rec.policy_name,rec.table_name;
    END IF;
  END LOOP;
END $casework_check$;

-- Exercise SQL privileges and RLS as the real non-bypass hustle_api role.
-- EXPLAIN (without ANALYZE) verifies INSERT can be planned but writes no rows.
BEGIN;
SET LOCAL ROLE hustle_api;
SELECT count(*) AS visible_cases FROM public."MarketplaceCase";
SELECT count(*) AS visible_case_notes FROM public."MarketplaceCaseNote";
UPDATE public."MarketplaceCase" SET "status" = "status" WHERE false;
EXPLAIN (COSTS OFF) INSERT INTO public."MarketplaceCase"
  ("id","subjectType","subjectId","title","summary","openedByUserId","updatedAt")
  VALUES ('ci-probe-case','BOOKING','ci-probe-subject','test','test','ci-probe-user',now());
EXPLAIN (COSTS OFF) INSERT INTO public."MarketplaceCaseNote"
  ("id","caseId","authorUserId","body")
  VALUES ('ci-probe-note','ci-probe-case','ci-probe-user','test');
ROLLBACK;

SELECT 'Marketplace casework API-only permissions passed' AS result;
