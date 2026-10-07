ALTER TYPE "AgentPermissionScope" ADD VALUE IF NOT EXISTS 'ACCOUNT_ONBOARDING_MANAGE';
ALTER TYPE "AgentPermissionScope" ADD VALUE IF NOT EXISTS 'HUSTLER_APPLICATION_MANAGE';

DO $$ BEGIN
  CREATE TYPE "AssistedRegistrationStatus" AS ENUM ('ACTIVE', 'CLAIMED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AssistedConsentMethod" AS ENUM ('IN_PERSON', 'PHONE', 'WRITTEN', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AgentAssistedRegistration" (
  "id" TEXT NOT NULL,
  "agentUserId" TEXT NOT NULL,
  "principalUserId" TEXT NOT NULL,
  "status" "AssistedRegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "consentMethod" "AssistedConsentMethod" NOT NULL,
  "consentNote" TEXT,
  "consentConfirmedAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentAssistedRegistration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentAssistedRegistration_principalUserId_key"
ON "AgentAssistedRegistration"("principalUserId");
CREATE INDEX IF NOT EXISTS "AgentAssistedRegistration_agentUserId_status_createdAt_idx"
ON "AgentAssistedRegistration"("agentUserId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "AgentAssistedRegistration_status_createdAt_idx"
ON "AgentAssistedRegistration"("status", "createdAt");

DO $$ BEGIN
  ALTER TABLE "AgentAssistedRegistration" ADD CONSTRAINT "AgentAssistedRegistration_agentUserId_fkey"
  FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AgentAssistedRegistration" ADD CONSTRAINT "AgentAssistedRegistration_principalUserId_fkey"
  FOREIGN KEY ("principalUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "AgentAssistedRegistration" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "AgentAssistedRegistration" FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "AgentAssistedRegistration" TO hustle_api;
DROP POLICY IF EXISTS hustle_api_agent_assisted_registration_all ON "AgentAssistedRegistration";
CREATE POLICY hustle_api_agent_assisted_registration_all ON "AgentAssistedRegistration"
FOR ALL TO hustle_api USING (true) WITH CHECK (true);
