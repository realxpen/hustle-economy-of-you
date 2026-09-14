-- Phase 13 finalization — repair historical payout ledger taxonomy.
-- Earlier Phase 13 sandbox rows used ORDER + a PAYOUT:<id> subjectId as a
-- placeholder. Reclassify only payout ledger transaction types.

UPDATE "LedgerTransaction"
SET
  "subjectType" = 'PAYOUT'::"FinancialSubjectType",
  "subjectId" = regexp_replace("subjectId", '^PAYOUT:', '')
WHERE
  "subjectType" = 'ORDER'::"FinancialSubjectType"
  AND "subjectId" LIKE 'PAYOUT:%'
  AND "type" IN ('PAYOUT_RESERVED', 'PAYOUT_SENT', 'PAYOUT_REVERSED');
