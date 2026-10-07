-- Phase 18B — Hustler↔Agent Relationship + Scoped Permission Grants.
-- Relationship and delegation authority is API-owned. Browser clients use Nest APIs.
-- Retry-safe because hosted Supabase may be prepared before Prisma records the migration.

DO $$ BEGIN
  CREATE TYPE "AgentRelationshipStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AgentPermissionScope" AS ENUM (
    'PROFILE_MANAGE',
    'SERVICE_MANAGE',
    'PRODUCT_MANAGE',
    'CONTENT_MANAGE',
    'BOOKING_MANAGE',
    'CLIENT_MESSAGE_MANAGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AgentRelationship" (
  "id" TEXT NOT NULL,
  "hustlerUserId" TEXT NOT NULL,
  "agentUserId" TEXT NOT NULL,
  "status" "AgentRelationshipStatus" NOT NULL DEFAULT 'PENDING',
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentRelationship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentPermissionGrant" (
  "id" TEXT NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "scope" "AgentPermissionScope" NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "grantedByUserId" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentPermissionGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AgentDelegationAudit" (
  "id" TEXT NOT NULL,
  "relationshipId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "permissionScope" "AgentPermissionScope",
  "action" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentDelegationAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AgentRelationship_hustlerUserId_agentUserId_key"
ON "AgentRelationship"("hustlerUserId", "agentUserId");
CREATE INDEX IF NOT EXISTS "AgentRelationship_hustlerUserId_status_idx"
ON "AgentRelationship"("hustlerUserId", "status");
CREATE INDEX IF NOT EXISTS "AgentRelationship_agentUserId_status_idx"
ON "AgentRelationship"("agentUserId", "status");
CREATE INDEX IF NOT EXISTS "AgentRelationship_status_invitedAt_idx"
ON "AgentRelationship"("status", "invitedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "AgentPermissionGrant_relationshipId_scope_key"
ON "AgentPermissionGrant"("relationshipId", "scope");
CREATE INDEX IF NOT EXISTS "AgentPermissionGrant_relationshipId_active_idx"
ON "AgentPermissionGrant"("relationshipId", "active");
CREATE INDEX IF NOT EXISTS "AgentPermissionGrant_grantedByUserId_grantedAt_idx"
ON "AgentPermissionGrant"("grantedByUserId", "grantedAt");

CREATE INDEX IF NOT EXISTS "AgentDelegationAudit_relationshipId_occurredAt_idx"
ON "AgentDelegationAudit"("relationshipId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AgentDelegationAudit_actorUserId_occurredAt_idx"
ON "AgentDelegationAudit"("actorUserId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AgentDelegationAudit_ownerUserId_occurredAt_idx"
ON "AgentDelegationAudit"("ownerUserId", "occurredAt");

DO $$ BEGIN
  ALTER TABLE "AgentRelationship" ADD CONSTRAINT "AgentRelationship_hustlerUserId_fkey"
  FOREIGN KEY ("hustlerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentRelationship" ADD CONSTRAINT "AgentRelationship_agentUserId_fkey"
  FOREIGN KEY ("agentUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentRelationship" ADD CONSTRAINT "AgentRelationship_revokedByUserId_fkey"
  FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentPermissionGrant" ADD CONSTRAINT "AgentPermissionGrant_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "AgentRelationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentPermissionGrant" ADD CONSTRAINT "AgentPermissionGrant_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentDelegationAudit" ADD CONSTRAINT "AgentDelegationAudit_relationshipId_fkey"
  FOREIGN KEY ("relationshipId") REFERENCES "AgentRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentDelegationAudit" ADD CONSTRAINT "AgentDelegationAudit_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgentDelegationAudit" ADD CONSTRAINT "AgentDelegationAudit_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "AgentRelationship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentPermissionGrant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentDelegationAudit" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "AgentRelationship", "AgentPermissionGrant", "AgentDelegationAudit"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "AgentRelationship", "AgentPermissionGrant", "AgentDelegationAudit"
TO hustle_api;

DROP POLICY IF EXISTS hustle_api_agent_relationship_all ON "AgentRelationship";
CREATE POLICY hustle_api_agent_relationship_all ON "AgentRelationship"
FOR ALL TO hustle_api USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hustle_api_agent_permission_grant_all ON "AgentPermissionGrant";
CREATE POLICY hustle_api_agent_permission_grant_all ON "AgentPermissionGrant"
FOR ALL TO hustle_api USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS hustle_api_agent_delegation_audit_all ON "AgentDelegationAudit";
CREATE POLICY hustle_api_agent_delegation_audit_all ON "AgentDelegationAudit"
FOR ALL TO hustle_api USING (true) WITH CHECK (true);
