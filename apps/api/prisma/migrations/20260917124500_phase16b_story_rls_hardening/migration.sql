-- Phase 16B Story table hardening.
--
-- This migration is intentionally retry-safe. The Story hardening was first
-- applied to the hosted Supabase project during the Phase 16B security gate,
-- so a later Prisma deploy may encounter the desired policies already present.
-- Recreating the policies inside the migration keeps the database state
-- deterministic while allowing Prisma's normal rolled-back migration recovery.

ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryReply" ENABLE ROW LEVEL SECURITY;

-- Story application tables are API-owned. Browser Data API roles must not have
-- direct table privileges; authenticated Story interactions go through Nest.
REVOKE ALL PRIVILEGES
ON TABLE "Story", "StoryView", "StoryReaction", "StoryReply"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "Story", "StoryView", "StoryReaction", "StoryReply"
TO hustle_api;

DROP POLICY IF EXISTS hustle_api_story_all ON "Story";
CREATE POLICY hustle_api_story_all
ON "Story"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS hustle_api_story_view_all ON "StoryView";
CREATE POLICY hustle_api_story_view_all
ON "StoryView"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS hustle_api_story_reaction_all ON "StoryReaction";
CREATE POLICY hustle_api_story_reaction_all
ON "StoryReaction"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS hustle_api_story_reply_all ON "StoryReply";
CREATE POLICY hustle_api_story_reply_all
ON "StoryReply"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

-- Storage object policy cleanup is performed through Supabase migration
-- authority rather than Prisma's application database role. The story-media
-- bucket is public for object delivery, while upload/delete remain owner-scoped.
