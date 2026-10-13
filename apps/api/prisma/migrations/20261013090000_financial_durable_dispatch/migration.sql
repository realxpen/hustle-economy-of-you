-- Durable server-owned financial dispatch. No provider call happens inside DB transactions.
-- Manual reconciliation required after ambiguous provider execution; never blindly retry.
CREATE TYPE "FinancialDispatchKind" AS ENUM ('PAYOUT', 'REFUND');
CREATE TYPE "FinancialDispatchState" AS ENUM ('QUEUED', 'DISPATCHING', 'SUBMITTED', 'OUTCOME_UNKNOWN');

CREATE TABLE "FinancialDispatchCommand" (
  "id" TEXT NOT NULL,
  "kind" "FinancialDispatchKind" NOT NULL,
  "operationId" TEXT NOT NULL,
  "state" "FinancialDispatchState" NOT NULL DEFAULT 'QUEUED',
  "attemptedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FinancialDispatchCommand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "FinancialDispatchCommand_operationId_key" ON "FinancialDispatchCommand"("operationId");
CREATE INDEX "FinancialDispatchCommand_state_createdAt_idx" ON "FinancialDispatchCommand"("state", "createdAt");

-- An attempt cannot be refunded twice concurrently or after successful refund.
-- FAILED attempts can be retried only after verified terminal provider failure.
CREATE UNIQUE INDEX "Refund_one_active_per_payment_idx" ON "Refund"("paymentAttemptId")
  WHERE "status" IN ('REQUESTED', 'PROCESSING', 'SUCCEEDED');

-- The migration must fail (rather than silently remove records) if any existing
-- refund state violates this invariant; never erase production financial history.

-- Server role only; unauthenticated/client database sessions cannot access
-- dispatch commands, which describe consequential financial operations.
ALTER TABLE "FinancialDispatchCommand" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON TABLE "FinancialDispatchCommand" TO hustle_api;
CREATE POLICY "financial_dispatch_api_role" ON "FinancialDispatchCommand"
  FOR ALL TO hustle_api USING (true) WITH CHECK (true);
