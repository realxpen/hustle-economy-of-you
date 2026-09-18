-- Phase 17B — Native Live Media Transport.
-- Publisher presence is API-owned and used only to expose real transport state.

CREATE TABLE "LiveMediaPresence" (
  "sessionId" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveMediaPresence_pkey" PRIMARY KEY ("sessionId")
);

CREATE INDEX "LiveMediaPresence_lastSeenAt_idx"
ON "LiveMediaPresence"("lastSeenAt");

ALTER TABLE "LiveMediaPresence"
ADD CONSTRAINT "LiveMediaPresence_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveMediaPresence" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "LiveMediaPresence"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "LiveMediaPresence"
TO hustle_api;

CREATE POLICY hustle_api_live_media_presence_all
ON "LiveMediaPresence"
FOR ALL TO hustle_api
USING (true)
WITH CHECK (true);
