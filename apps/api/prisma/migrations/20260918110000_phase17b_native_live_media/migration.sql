-- Phase 17B — Native Live Media Transport.
-- Publisher presence is API-owned and used only to expose real transport state.
-- This migration is retry-safe because the hosted database may be prepared
-- through Supabase before a later Prisma migrate deploy records the migration.

CREATE TABLE IF NOT EXISTS "LiveMediaPresence" (
  "sessionId" TEXT NOT NULL,
  "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LiveMediaPresence_pkey" PRIMARY KEY ("sessionId")
);

CREATE INDEX IF NOT EXISTS "LiveMediaPresence_lastSeenAt_idx"
ON "LiveMediaPresence"("lastSeenAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'LiveMediaPresence_sessionId_fkey'
      AND conrelid = '"LiveMediaPresence"'::regclass
  ) THEN
    ALTER TABLE "LiveMediaPresence"
    ADD CONSTRAINT "LiveMediaPresence_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

ALTER TABLE "LiveMediaPresence" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "LiveMediaPresence"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "LiveMediaPresence"
TO hustle_api;

DROP POLICY IF EXISTS hustle_api_live_media_presence_all ON "LiveMediaPresence";
CREATE POLICY hustle_api_live_media_presence_all
ON "LiveMediaPresence"
FOR ALL TO hustle_api
USING (true)
WITH CHECK (true);
