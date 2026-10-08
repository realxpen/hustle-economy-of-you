CREATE TYPE "MarketplaceModerationState" AS ENUM ('CLEAR', 'HELD');
CREATE TYPE "MarketplaceModerationSubjectType" AS ENUM ('POST', 'SERVICE', 'PRODUCT');
CREATE TYPE "MarketplaceModerationActionType" AS ENUM ('HOLD', 'RELEASE');

ALTER TABLE "Post" ADD COLUMN "moderationState" "MarketplaceModerationState" NOT NULL DEFAULT 'CLEAR';
ALTER TABLE "Service" ADD COLUMN "moderationState" "MarketplaceModerationState" NOT NULL DEFAULT 'CLEAR';
ALTER TABLE "Product" ADD COLUMN "moderationState" "MarketplaceModerationState" NOT NULL DEFAULT 'CLEAR';

CREATE TABLE "MarketplaceModerationAction" (
  "id" TEXT NOT NULL,
  "subjectType" "MarketplaceModerationSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" "MarketplaceModerationActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "resultingStatus" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceModerationAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketplaceModerationAction_subjectType_subjectId_createdAt_idx"
  ON "MarketplaceModerationAction" ("subjectType", "subjectId", "createdAt");
CREATE INDEX "MarketplaceModerationAction_actorUserId_createdAt_idx"
  ON "MarketplaceModerationAction" ("actorUserId", "createdAt");
CREATE INDEX "MarketplaceModerationAction_ownerUserId_createdAt_idx"
  ON "MarketplaceModerationAction" ("ownerUserId", "createdAt");
ALTER TABLE "MarketplaceModerationAction"
  ADD CONSTRAINT "MarketplaceModerationAction_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketplaceModerationAction" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "MarketplaceModerationAction"
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE "MarketplaceModerationAction" TO hustle_api;
CREATE POLICY hustle_api_marketplace_moderation_audit_read
  ON "MarketplaceModerationAction" FOR SELECT TO hustle_api USING (true);
CREATE POLICY hustle_api_marketplace_moderation_audit_insert
  ON "MarketplaceModerationAction" FOR INSERT TO hustle_api WITH CHECK (true);
