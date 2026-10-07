ALTER TABLE "Message"
ADD COLUMN IF NOT EXISTS "delegatedByAgentUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Message_delegatedByAgentUserId_createdAt_idx"
ON "Message"("delegatedByAgentUserId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "Message"
  ADD CONSTRAINT "Message_delegatedByAgentUserId_fkey"
  FOREIGN KEY ("delegatedByAgentUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
