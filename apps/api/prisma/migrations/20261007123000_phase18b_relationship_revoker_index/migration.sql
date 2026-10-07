-- Phase 18B advisor hardening: cover the optional revoker foreign key.
CREATE INDEX IF NOT EXISTS "AgentRelationship_revokedByUserId_idx"
ON "AgentRelationship"("revokedByUserId");
