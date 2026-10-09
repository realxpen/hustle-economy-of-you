-- Phase 20A — persistent, private notification inbox.
-- Only the API database role can access notification rows directly.

CREATE TYPE "NotificationKind" AS ENUM (
  'MESSAGE', 'BOOKING', 'ORDER', 'APPLICATION', 'REVIEW', 'LIVE', 'SOCIAL', 'SAFETY'
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "recipientUserId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "kind" "NotificationKind" NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "href" TEXT NOT NULL,
  "readAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_recipientUserId_eventKey_key"
  ON "Notification"("recipientUserId", "eventKey");

CREATE INDEX "Notification_recipientUserId_createdAt_id_idx"
  ON "Notification"("recipientUserId", "createdAt", "id");

CREATE INDEX "Notification_recipientUserId_readAt_createdAt_idx"
  ON "Notification"("recipientUserId", "readAt", "createdAt");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_recipientUserId_fkey"
  FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "Notification" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE "Notification" TO hustle_api;

CREATE POLICY hustle_api_notification_select
  ON "Notification" FOR SELECT TO hustle_api USING (true);
CREATE POLICY hustle_api_notification_insert
  ON "Notification" FOR INSERT TO hustle_api WITH CHECK (true);
CREATE POLICY hustle_api_notification_update
  ON "Notification" FOR UPDATE TO hustle_api USING (true) WITH CHECK (true);
