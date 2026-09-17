ALTER TABLE "Story"
  ADD COLUMN "mediaStorageKey" TEXT;

CREATE TABLE "StoryView" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "viewerKey" TEXT NOT NULL,
  "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastViewedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StoryView_storyId_viewerKey_key" ON "StoryView"("storyId", "viewerKey");
CREATE INDEX "StoryView_storyId_firstViewedAt_idx" ON "StoryView"("storyId", "firstViewedAt");

CREATE TABLE "StoryReaction" (
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "reaction" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryReaction_pkey" PRIMARY KEY ("storyId", "userId")
);

CREATE INDEX "StoryReaction_storyId_reaction_idx" ON "StoryReaction"("storyId", "reaction");
CREATE INDEX "StoryReaction_userId_updatedAt_idx" ON "StoryReaction"("userId", "updatedAt");

CREATE TABLE "StoryReply" (
  "id" TEXT NOT NULL,
  "storyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StoryReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StoryReply_storyId_createdAt_idx" ON "StoryReply"("storyId", "createdAt");
CREATE INDEX "StoryReply_userId_createdAt_idx" ON "StoryReply"("userId", "createdAt");

ALTER TYPE "MessageContextType" ADD VALUE IF NOT EXISTS 'STORY';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'story-media',
  'story-media',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story_media_insert_own') THEN
    CREATE POLICY story_media_insert_own ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id = 'story-media'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story_media_delete_own') THEN
    CREATE POLICY story_media_delete_own ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'story-media'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'story_media_select_public') THEN
    CREATE POLICY story_media_select_public ON storage.objects
      FOR SELECT TO public
      USING (bucket_id = 'story-media');
  END IF;
END $$;
