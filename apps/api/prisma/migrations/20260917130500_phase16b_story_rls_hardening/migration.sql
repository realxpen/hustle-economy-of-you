-- Phase 16B security hardening.
-- Story data is API-owned. Browser clients use the Nest API for Story records and
-- Supabase Storage RLS only for native media objects.

ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryReply" ENABLE ROW LEVEL SECURITY;

-- Supabase applies broad default grants to tables created in the exposed public
-- schema. Remove direct Data API access; all Story record access is server-authoritative.
REVOKE ALL PRIVILEGES ON TABLE "Story", "StoryView", "StoryReaction", "StoryReply"
FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE "Story", "StoryView", "StoryReaction", "StoryReply"
TO hustle_api;

CREATE POLICY hustle_api_story_all
ON "Story"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_story_view_all
ON "StoryView"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_story_reaction_all
ON "StoryReaction"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_story_reply_all
ON "StoryReply"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
