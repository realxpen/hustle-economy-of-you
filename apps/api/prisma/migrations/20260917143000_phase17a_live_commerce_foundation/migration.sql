-- Phase 17A — Live Commerce Foundation.
-- Live session/control state is API-owned; browser clients use Nest APIs.

CREATE TYPE "LiveSessionStatus" AS ENUM ('DRAFT', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "LivePinnedOfferType" AS ENUM ('SERVICE', 'PRODUCT');

CREATE TABLE "LiveSession" (
  "id" TEXT NOT NULL,
  "hostUserId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "status" "LiveSessionStatus" NOT NULL DEFAULT 'DRAFT',
  "pinnedOfferType" "LivePinnedOfferType",
  "pinnedServiceId" TEXT,
  "pinnedProductId" TEXT,
  "playbackUrl" TEXT,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LiveViewerPresence" (
  "sessionId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveViewerPresence_pkey" PRIMARY KEY ("sessionId", "viewerKey")
);

CREATE TABLE "LiveComment" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveSession_status_startedAt_idx" ON "LiveSession"("status", "startedAt");
CREATE INDEX "LiveSession_hostUserId_createdAt_idx" ON "LiveSession"("hostUserId", "createdAt");
CREATE INDEX "LiveViewerPresence_sessionId_lastSeenAt_idx" ON "LiveViewerPresence"("sessionId", "lastSeenAt");
CREATE INDEX "LiveComment_sessionId_createdAt_idx" ON "LiveComment"("sessionId", "createdAt");
CREATE INDEX "LiveComment_userId_createdAt_idx" ON "LiveComment"("userId", "createdAt");

ALTER TABLE "LiveViewerPresence"
ADD CONSTRAINT "LiveViewerPresence_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveComment"
ADD CONSTRAINT "LiveComment_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveViewerPresence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveComment" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "LiveSession", "LiveViewerPresence", "LiveComment"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "LiveSession", "LiveViewerPresence", "LiveComment"
TO hustle_api;

CREATE POLICY hustle_api_live_session_all
ON "LiveSession"
FOR ALL TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_live_viewer_presence_all
ON "LiveViewerPresence"
FOR ALL TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_live_comment_all
ON "LiveComment"
FOR ALL TO hustle_api
USING (true)
WITH CHECK (true);
