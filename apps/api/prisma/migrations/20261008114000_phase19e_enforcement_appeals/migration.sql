CREATE TYPE "EnforcementAppealActionType" AS ENUM ('CONTENT_HOLD', 'CAPABILITY_SUSPENSION');
CREATE TYPE "EnforcementAppealStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'DECIDED', 'CLOSED');
CREATE TYPE "EnforcementAppealDecision" AS ENUM ('UPHELD', 'OVERTURNED');

CREATE TABLE "EnforcementAppeal" (
  "id" TEXT NOT NULL,
  "actionType" "EnforcementAppealActionType" NOT NULL,
  "enforcementRef" TEXT NOT NULL,
  "targetKind" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "appellantUserId" TEXT NOT NULL,
  "originalActorUserId" TEXT NOT NULL,
  "assignedReviewerUserId" TEXT,
  "reason" TEXT NOT NULL,
  "status" "EnforcementAppealStatus" NOT NULL DEFAULT 'SUBMITTED',
  "decision" "EnforcementAppealDecision",
  "decisionReason" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewStartedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EnforcementAppeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnforcementAppeal_enforcementRef_key"
  ON "EnforcementAppeal"("enforcementRef");
CREATE INDEX "EnforcementAppeal_appellantUserId_submittedAt_idx"
  ON "EnforcementAppeal"("appellantUserId", "submittedAt");
CREATE INDEX "EnforcementAppeal_status_submittedAt_idx"
  ON "EnforcementAppeal"("status", "submittedAt");
CREATE INDEX "EnforcementAppeal_assignedReviewerUserId_status_updatedAt_idx"
  ON "EnforcementAppeal"("assignedReviewerUserId", "status", "updatedAt");
CREATE INDEX "EnforcementAppeal_originalActorUserId_createdAt_idx"
  ON "EnforcementAppeal"("originalActorUserId", "createdAt");

ALTER TABLE "EnforcementAppeal"
  ADD CONSTRAINT "EnforcementAppeal_appellantUserId_fkey"
  FOREIGN KEY ("appellantUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnforcementAppeal"
  ADD CONSTRAINT "EnforcementAppeal_originalActorUserId_fkey"
  FOREIGN KEY ("originalActorUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EnforcementAppeal"
  ADD CONSTRAINT "EnforcementAppeal_assignedReviewerUserId_fkey"
  FOREIGN KEY ("assignedReviewerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EnforcementAppeal" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "EnforcementAppeal" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE "EnforcementAppeal" TO hustle_api;

CREATE POLICY hustle_api_enforcement_appeal_select
  ON "EnforcementAppeal" FOR SELECT TO hustle_api USING (true);
CREATE POLICY hustle_api_enforcement_appeal_insert
  ON "EnforcementAppeal" FOR INSERT TO hustle_api WITH CHECK (true);
CREATE POLICY hustle_api_enforcement_appeal_update
  ON "EnforcementAppeal" FOR UPDATE TO hustle_api USING (true) WITH CHECK (true);
