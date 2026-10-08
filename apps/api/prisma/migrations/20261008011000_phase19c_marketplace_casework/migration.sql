CREATE TYPE "MarketplaceCaseSubjectType" AS ENUM ('BOOKING', 'ORDER');
CREATE TYPE "MarketplaceCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'WAITING_INFORMATION', 'RESOLVED', 'CLOSED');
CREATE TYPE "MarketplaceCasePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH');

CREATE TABLE "MarketplaceCase" (
  "id" TEXT NOT NULL,
  "subjectType" "MarketplaceCaseSubjectType" NOT NULL,
  "subjectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "status" "MarketplaceCaseStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "MarketplaceCasePriority" NOT NULL DEFAULT 'NORMAL',
  "openedByUserId" TEXT NOT NULL,
  "assignedToUserId" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MarketplaceCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MarketplaceCaseNote" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "authorUserId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceCaseNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketplaceCase_subjectType_subjectId_key"
  ON "MarketplaceCase"("subjectType", "subjectId");
CREATE INDEX "MarketplaceCase_status_priority_updatedAt_idx"
  ON "MarketplaceCase"("status", "priority", "updatedAt");
CREATE INDEX "MarketplaceCase_assignedToUserId_status_updatedAt_idx"
  ON "MarketplaceCase"("assignedToUserId", "status", "updatedAt");
CREATE INDEX "MarketplaceCase_openedByUserId_createdAt_idx"
  ON "MarketplaceCase"("openedByUserId", "createdAt");
CREATE INDEX "MarketplaceCaseNote_caseId_createdAt_idx"
  ON "MarketplaceCaseNote"("caseId", "createdAt");
CREATE INDEX "MarketplaceCaseNote_authorUserId_createdAt_idx"
  ON "MarketplaceCaseNote"("authorUserId", "createdAt");

ALTER TABLE "MarketplaceCase"
 ADD CONSTRAINT "MarketplaceCase_openedByUserId_fkey"
 FOREIGN KEY ("openedByUserId") REFERENCES "User"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCase"
 ADD CONSTRAINT "MarketplaceCase_assignedToUserId_fkey"
 FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id")
 ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCaseNote"
 ADD CONSTRAINT "MarketplaceCaseNote_caseId_fkey"
 FOREIGN KEY ("caseId") REFERENCES "MarketplaceCase"("id")
 ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MarketplaceCaseNote"
 ADD CONSTRAINT "MarketplaceCaseNote_authorUserId_fkey"
 FOREIGN KEY ("authorUserId") REFERENCES "User"("id")
 ON DELETE RESTRICT ON UPDATE CASCADE;

-- These are strictly server-side internal case records, never Supabase client data.
ALTER TABLE "MarketplaceCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketplaceCaseNote" ENABLE ROW LEVEL SECURITY;
