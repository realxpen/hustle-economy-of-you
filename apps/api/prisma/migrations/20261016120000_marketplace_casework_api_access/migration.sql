-- Additive Phase 19C follow-up: allow the Nest API to operate Marketplace casework.
-- The original 20261008011000 migration exists in hosted Supabase but was not
-- recorded in Prisma's migration ledger; do not edit or replay that migration.
-- Apply only after the historical ledgers have been reconciled and approved.
-- This migration does not alter case rows, financial state or provider integrations.
-- The API's AuthGuard + AdminGuard authorize individual admin operations;
-- the dedicated hustle_api database role is trusted server-side only.

ALTER TABLE public."MarketplaceCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketplaceCaseNote" ENABLE ROW LEVEL SECURITY;

-- Browser-facing roles must never access sensitive dispute casework directly.
REVOKE ALL PRIVILEGES ON TABLE public."MarketplaceCase", public."MarketplaceCaseNote"
  FROM PUBLIC, anon, authenticated, hustle_api;

-- Case workflows list/create/claim/release/change state. No hard deletes.
GRANT SELECT, INSERT, UPDATE ON TABLE public."MarketplaceCase" TO hustle_api;
-- Notes are append-only; the API can read and create them, not update/delete.
GRANT SELECT, INSERT ON TABLE public."MarketplaceCaseNote" TO hustle_api;

DROP POLICY IF EXISTS hustle_api_marketplace_case_select ON public."MarketplaceCase";
DROP POLICY IF EXISTS hustle_api_marketplace_case_insert ON public."MarketplaceCase";
DROP POLICY IF EXISTS hustle_api_marketplace_case_update ON public."MarketplaceCase";
CREATE POLICY hustle_api_marketplace_case_select
  ON public."MarketplaceCase" FOR SELECT TO hustle_api USING (true);
CREATE POLICY hustle_api_marketplace_case_insert
  ON public."MarketplaceCase" FOR INSERT TO hustle_api WITH CHECK (true);
CREATE POLICY hustle_api_marketplace_case_update
  ON public."MarketplaceCase" FOR UPDATE TO hustle_api
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hustle_api_marketplace_case_note_select ON public."MarketplaceCaseNote";
DROP POLICY IF EXISTS hustle_api_marketplace_case_note_insert ON public."MarketplaceCaseNote";
CREATE POLICY hustle_api_marketplace_case_note_select
  ON public."MarketplaceCaseNote" FOR SELECT TO hustle_api USING (true);
CREATE POLICY hustle_api_marketplace_case_note_insert
  ON public."MarketplaceCaseNote" FOR INSERT TO hustle_api WITH CHECK (true);
