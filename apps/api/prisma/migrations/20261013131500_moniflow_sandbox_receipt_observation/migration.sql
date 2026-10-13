-- Test-only MONIFlow receipt observation. Not payment settlement/escrow.
CREATE TABLE "MoniflowSandboxReceiptObservation" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "operationId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL CHECK ("amountMinor" > 0),
  "currency" TEXT NOT NULL CHECK ("currency" = 'NGN'),
  "commandDigest" TEXT NOT NULL,
  "receiptDigest" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MoniflowSandboxReceiptObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MoniflowSandboxReceiptObservation_kind_check" CHECK ("kind" IN ('COLLECTION','PAYOUT','REFUND'))
);
CREATE UNIQUE INDEX "MoniflowSandboxReceiptObservation_eventId_key" ON "MoniflowSandboxReceiptObservation"("eventId");
CREATE UNIQUE INDEX "MoniflowSandboxReceiptObservation_operationId_key" ON "MoniflowSandboxReceiptObservation"("operationId");
CREATE INDEX "MoniflowSandboxReceiptObservation_kind_observedAt_idx"
  ON "MoniflowSandboxReceiptObservation"("kind", "observedAt");
ALTER TABLE "MoniflowSandboxReceiptObservation" ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON TABLE "MoniflowSandboxReceiptObservation" TO hustle_api;
CREATE POLICY "moniflow_sandbox_receipt_observation_api_role"
  ON "MoniflowSandboxReceiptObservation"
  FOR ALL TO hustle_api USING (true) WITH CHECK (true);
