-- Phase 14D-A — Counterparty Trust + Safety foundation

CREATE TYPE "CounterpartyFeedbackIssue" AS ENUM (
  'NO_SHOW',
  'ABUSIVE_BEHAVIOR',
  'SCOPE_MANIPULATION',
  'REPEATED_CANCELLATION',
  'FRAUD_SUSPICIOUS',
  'DISPUTE_ABUSE',
  'COMMUNICATION_PROBLEMS',
  'PAYMENT_ABUSE',
  'OTHER'
);

CREATE TYPE "SafetyReportCategory" AS ENUM (
  'HARASSMENT',
  'FRAUD_SCAM',
  'THREATS',
  'FAKE_IDENTITY',
  'PAYMENT_ABUSE',
  'PROHIBITED_GOODS_SERVICES',
  'SPAM',
  'OFF_PLATFORM_MANIPULATION',
  'OTHER'
);

CREATE TYPE "SafetyReportStatus" AS ENUM (
  'OPEN',
  'UNDER_REVIEW',
  'ACTIONED',
  'DISMISSED'
);

CREATE TABLE "CounterpartyFeedback" (
  "id" TEXT NOT NULL,
  "subjectType" "ReviewSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "authorRole" "ReviewPartyRole" NOT NULL,
  "targetRole" "ReviewPartyRole" NOT NULL,
  "wouldWorkAgain" BOOLEAN NOT NULL,
  "experienceRating" INTEGER,
  "issueCategories" "CounterpartyFeedbackIssue"[] NOT NULL DEFAULT ARRAY[]::"CounterpartyFeedbackIssue"[],
  "privateNote" TEXT,
  "transactionStatusSnapshot" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CounterpartyFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CounterpartyFeedback_no_self" CHECK ("authorUserId" <> "targetUserId"),
  CONSTRAINT "CounterpartyFeedback_rating_range" CHECK ("experienceRating" IS NULL OR "experienceRating" BETWEEN 1 AND 5),
  CONSTRAINT "CounterpartyFeedback_note_length" CHECK ("privateNote" IS NULL OR char_length("privateNote") <= 2000),
  CONSTRAINT "CounterpartyFeedback_role_pair" CHECK (
    ("subjectType" = 'BOOKING' AND "authorRole" = 'HUSTLER' AND "targetRole" = 'CLIENT') OR
    ("subjectType" = 'ORDER' AND "authorRole" = 'SELLER' AND "targetRole" = 'BUYER')
  )
);

CREATE TABLE "SafetyReport" (
  "id" TEXT NOT NULL,
  "subjectType" "ReviewSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "reporterUserId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "category" "SafetyReportCategory" NOT NULL,
  "details" TEXT NOT NULL,
  "status" "SafetyReportStatus" NOT NULL DEFAULT 'OPEN',
  "moderationNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SafetyReport_no_self" CHECK ("reporterUserId" <> "targetUserId"),
  CONSTRAINT "SafetyReport_details_length" CHECK (char_length("details") BETWEEN 10 AND 2000),
  CONSTRAINT "SafetyReport_moderation_note_length" CHECK ("moderationNote" IS NULL OR char_length("moderationNote") <= 4000)
);

CREATE TABLE "UserBlock" (
  "blockerUserId" TEXT NOT NULL,
  "blockedUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerUserId", "blockedUserId"),
  CONSTRAINT "UserBlock_no_self" CHECK ("blockerUserId" <> "blockedUserId")
);

CREATE UNIQUE INDEX "CounterpartyFeedback_subjectType_subjectId_authorUserId_key"
ON "CounterpartyFeedback"("subjectType", "subjectId", "authorUserId");

CREATE INDEX "CounterpartyFeedback_targetUserId_createdAt_idx"
ON "CounterpartyFeedback"("targetUserId", "createdAt");

CREATE INDEX "CounterpartyFeedback_authorUserId_createdAt_idx"
ON "CounterpartyFeedback"("authorUserId", "createdAt");

CREATE INDEX "CounterpartyFeedback_subjectType_subjectId_idx"
ON "CounterpartyFeedback"("subjectType", "subjectId");

CREATE UNIQUE INDEX "SafetyReport_reporterUserId_subjectType_subjectId_category_key"
ON "SafetyReport"("reporterUserId", "subjectType", "subjectId", "category");

CREATE INDEX "SafetyReport_targetUserId_status_createdAt_idx"
ON "SafetyReport"("targetUserId", "status", "createdAt");

CREATE INDEX "SafetyReport_reporterUserId_createdAt_idx"
ON "SafetyReport"("reporterUserId", "createdAt");

CREATE INDEX "SafetyReport_status_createdAt_idx"
ON "SafetyReport"("status", "createdAt");

CREATE INDEX "UserBlock_blockedUserId_createdAt_idx"
ON "UserBlock"("blockedUserId", "createdAt");

ALTER TABLE "CounterpartyFeedback"
ADD CONSTRAINT "CounterpartyFeedback_authorUserId_fkey"
FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CounterpartyFeedback"
ADD CONSTRAINT "CounterpartyFeedback_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SafetyReport"
ADD CONSTRAINT "SafetyReport_reporterUserId_fkey"
FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SafetyReport"
ADD CONSTRAINT "SafetyReport_targetUserId_fkey"
FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
ADD CONSTRAINT "UserBlock_blockerUserId_fkey"
FOREIGN KEY ("blockerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
ADD CONSTRAINT "UserBlock_blockedUserId_fkey"
FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CounterpartyFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SafetyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserBlock" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "counterparty_feedback_api_role"
ON "CounterpartyFeedback" FOR ALL TO hustle_api USING (true) WITH CHECK (true);

CREATE POLICY "safety_report_api_role"
ON "SafetyReport" FOR ALL TO hustle_api USING (true) WITH CHECK (true);

CREATE POLICY "user_block_api_role"
ON "UserBlock" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
