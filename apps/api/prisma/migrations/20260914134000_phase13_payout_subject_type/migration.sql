-- Phase 13 finalization — give payout ledger movements their own subject taxonomy.
-- Keep this migration separate from the data backfill because PostgreSQL enum
-- values must be committed before they are safely used by later statements.

ALTER TYPE "FinancialSubjectType" ADD VALUE IF NOT EXISTS 'PAYOUT';
