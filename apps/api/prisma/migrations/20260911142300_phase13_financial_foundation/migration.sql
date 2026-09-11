-- Phase 13A — financial data foundation

CREATE TYPE "FinancialSubjectType" AS ENUM ('BOOKING', 'ORDER');
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('INITIATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "FinancialAccountType" AS ENUM ('PROVIDER_CLEARING', 'ESCROW', 'PENDING', 'AVAILABLE', 'PAYOUT_RESERVED');
CREATE TYPE "LedgerTransactionType" AS ENUM ('PAYMENT_CONFIRMED', 'ESCROW_HELD', 'ESCROW_RELEASED', 'REFUND', 'PAYOUT_RESERVED', 'PAYOUT_SENT', 'PAYOUT_REVERSED', 'ADJUSTMENT');
CREATE TYPE "LedgerPostingDirection" AS ENUM ('DEBIT', 'CREDIT');
CREATE TYPE "EscrowStatus" AS ENUM ('PENDING', 'HELD', 'RELEASED', 'REFUND_PENDING', 'REFUNDED', 'CANCELLED');
CREATE TYPE "FinancialOperationStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');

CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "subjectType" "FinancialSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "payerUserId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "providerMetadata" JSONB,
    "confirmedAt" TIMESTAMP(3),
    "domainAppliedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureCode" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAttempt_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "FinancialAccountType" NOT NULL,
    "currency" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "subjectType" "FinancialSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "type" "LedgerTransactionType" NOT NULL,
    "reference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerPosting" (
    "id" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "LedgerPostingDirection" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerPosting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LedgerPosting_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "EscrowRecord" (
    "id" TEXT NOT NULL,
    "subjectType" "FinancialSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "beneficiaryUserId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "EscrowStatus" NOT NULL DEFAULT 'PENDING',
    "heldAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EscrowRecord_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EscrowRecord_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "FinancialOperationStatus" NOT NULL DEFAULT 'REQUESTED',
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payout_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "subjectType" "FinancialSubjectType" NOT NULL,
    "subjectId" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "requestedByUserId" TEXT,
    "currency" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "FinancialOperationStatus" NOT NULL DEFAULT 'REQUESTED',
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Refund_amount_positive" CHECK ("amountMinor" > 0)
);

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentAttemptId" TEXT,
    "eventType" TEXT NOT NULL,
    "providerReference" TEXT,
    "payloadDigest" TEXT NOT NULL,
    "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAttempt_providerReference_key" ON "PaymentAttempt"("providerReference");
CREATE UNIQUE INDEX "PaymentAttempt_idempotencyKey_key" ON "PaymentAttempt"("idempotencyKey");
CREATE INDEX "PaymentAttempt_payerUserId_status_createdAt_idx" ON "PaymentAttempt"("payerUserId", "status", "createdAt");
CREATE INDEX "PaymentAttempt_beneficiaryUserId_status_createdAt_idx" ON "PaymentAttempt"("beneficiaryUserId", "status", "createdAt");
CREATE INDEX "PaymentAttempt_subjectType_subjectId_createdAt_idx" ON "PaymentAttempt"("subjectType", "subjectId", "createdAt");
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

CREATE UNIQUE INDEX "LedgerAccount_key_key" ON "LedgerAccount"("key");
CREATE INDEX "LedgerAccount_userId_type_currency_idx" ON "LedgerAccount"("userId", "type", "currency");
CREATE INDEX "LedgerAccount_type_currency_idx" ON "LedgerAccount"("type", "currency");

CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");
CREATE INDEX "LedgerTransaction_subjectType_subjectId_createdAt_idx" ON "LedgerTransaction"("subjectType", "subjectId", "createdAt");
CREATE INDEX "LedgerTransaction_paymentAttemptId_createdAt_idx" ON "LedgerTransaction"("paymentAttemptId", "createdAt");
CREATE INDEX "LedgerTransaction_type_createdAt_idx" ON "LedgerTransaction"("type", "createdAt");

CREATE INDEX "LedgerPosting_ledgerTransactionId_idx" ON "LedgerPosting"("ledgerTransactionId");
CREATE INDEX "LedgerPosting_accountId_createdAt_idx" ON "LedgerPosting"("accountId", "createdAt");

CREATE UNIQUE INDEX "EscrowRecord_paymentAttemptId_key" ON "EscrowRecord"("paymentAttemptId");
CREATE UNIQUE INDEX "EscrowRecord_subjectType_subjectId_key" ON "EscrowRecord"("subjectType", "subjectId");
CREATE INDEX "EscrowRecord_beneficiaryUserId_status_createdAt_idx" ON "EscrowRecord"("beneficiaryUserId", "status", "createdAt");
CREATE INDEX "EscrowRecord_status_createdAt_idx" ON "EscrowRecord"("status", "createdAt");

CREATE UNIQUE INDEX "Payout_providerReference_key" ON "Payout"("providerReference");
CREATE UNIQUE INDEX "Payout_idempotencyKey_key" ON "Payout"("idempotencyKey");
CREATE INDEX "Payout_userId_status_createdAt_idx" ON "Payout"("userId", "status", "createdAt");
CREATE INDEX "Payout_status_createdAt_idx" ON "Payout"("status", "createdAt");

CREATE UNIQUE INDEX "Refund_providerReference_key" ON "Refund"("providerReference");
CREATE UNIQUE INDEX "Refund_idempotencyKey_key" ON "Refund"("idempotencyKey");
CREATE INDEX "Refund_subjectType_subjectId_createdAt_idx" ON "Refund"("subjectType", "subjectId", "createdAt");
CREATE INDEX "Refund_paymentAttemptId_status_idx" ON "Refund"("paymentAttemptId", "status");
CREATE INDEX "Refund_status_createdAt_idx" ON "Refund"("status", "createdAt");

CREATE UNIQUE INDEX "WebhookEvent_provider_eventId_key" ON "WebhookEvent"("provider", "eventId");
CREATE INDEX "WebhookEvent_paymentAttemptId_createdAt_idx" ON "WebhookEvent"("paymentAttemptId", "createdAt");
CREATE INDEX "WebhookEvent_providerReference_createdAt_idx" ON "WebhookEvent"("providerReference", "createdAt");
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");

ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LedgerPosting" ADD CONSTRAINT "LedgerPosting_ledgerTransactionId_fkey" FOREIGN KEY ("ledgerTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerPosting" ADD CONSTRAINT "LedgerPosting_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EscrowRecord" ADD CONSTRAINT "EscrowRecord_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PaymentAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LedgerPosting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EscrowRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Refund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WebhookEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_attempt_api_role" ON "PaymentAttempt" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "ledger_account_api_role" ON "LedgerAccount" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "ledger_transaction_api_role" ON "LedgerTransaction" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "ledger_posting_api_role" ON "LedgerPosting" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "escrow_record_api_role" ON "EscrowRecord" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "payout_api_role" ON "Payout" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "refund_api_role" ON "Refund" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "webhook_event_api_role" ON "WebhookEvent" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
