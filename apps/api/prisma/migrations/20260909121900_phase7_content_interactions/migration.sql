CREATE TABLE "PostLike" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE TABLE "PostSave" (
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostSave_pkey" PRIMARY KEY ("postId", "userId")
);

CREATE TABLE "PostComment" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "parentId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PostComment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostComment_body_check" CHECK (char_length(btrim("body")) BETWEEN 1 AND 1200)
);

CREATE TABLE "UserFollow" (
  "followerId" TEXT NOT NULL,
  "followingId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("followerId", "followingId"),
  CONSTRAINT "UserFollow_no_self_check" CHECK ("followerId" <> "followingId")
);

CREATE INDEX "PostLike_userId_createdAt_idx" ON "PostLike"("userId", "createdAt");
CREATE INDEX "PostSave_userId_createdAt_idx" ON "PostSave"("userId", "createdAt");
CREATE INDEX "PostComment_postId_createdAt_idx" ON "PostComment"("postId", "createdAt");
CREATE INDEX "PostComment_userId_createdAt_idx" ON "PostComment"("userId", "createdAt");
CREATE INDEX "PostComment_parentId_idx" ON "PostComment"("parentId");
CREATE INDEX "UserFollow_followingId_createdAt_idx" ON "UserFollow"("followingId", "createdAt");

ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostSave" ADD CONSTRAINT "PostSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostComment" ADD CONSTRAINT "PostComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "PostComment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostLike" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostSave" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserFollow" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PostLike" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PostSave" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PostComment" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "UserFollow" TO hustle_api;

CREATE POLICY "hustle_api_all_post_likes" ON "PostLike" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_post_saves" ON "PostSave" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_post_comments" ON "PostComment" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_user_follows" ON "UserFollow" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
