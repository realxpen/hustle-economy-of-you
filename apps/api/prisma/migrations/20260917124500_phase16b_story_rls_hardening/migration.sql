ALTER TABLE "Story" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryReaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StoryReply" ENABLE ROW LEVEL SECURITY;

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

-- `story-media` is already a public bucket, so public reads are served through
-- the Storage public-object URL. Do not expose raw storage.objects SELECT/list
-- access through an extra public RLS policy.
DROP POLICY IF EXISTS story_media_select_public ON storage.objects;
