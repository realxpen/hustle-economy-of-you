CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "PostMediaType" AS ENUM ('IMAGE', 'VIDEO');

CREATE TABLE "Post" (
  "id" TEXT NOT NULL,
  "professionalProfileId" TEXT NOT NULL,
  "caption" TEXT,
  "category" TEXT,
  "location" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PostMedia" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "type" "PostMediaType" NOT NULL,
  "storageKey" TEXT,
  "mediaUrl" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "width" INTEGER,
  "height" INTEGER,
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostMedia_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PostMedia_source_check" CHECK ("storageKey" IS NOT NULL OR "mediaUrl" IS NOT NULL),
  CONSTRAINT "PostMedia_position_check" CHECK ("position" >= 0),
  CONSTRAINT "PostMedia_width_check" CHECK ("width" IS NULL OR "width" > 0),
  CONSTRAINT "PostMedia_height_check" CHECK ("height" IS NULL OR "height" > 0),
  CONSTRAINT "PostMedia_duration_check" CHECK ("durationMs" IS NULL OR "durationMs" >= 0)
);

CREATE TABLE "PostServiceAttachment" (
  "postId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostServiceAttachment_pkey" PRIMARY KEY ("postId", "serviceId")
);

CREATE TABLE "PostProductAttachment" (
  "postId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PostProductAttachment_pkey" PRIMARY KEY ("postId", "productId")
);

CREATE INDEX "Post_professionalProfileId_status_idx" ON "Post"("professionalProfileId", "status");
CREATE INDEX "Post_status_createdAt_idx" ON "Post"("status", "createdAt");
CREATE INDEX "Post_category_idx" ON "Post"("category");
CREATE INDEX "PostMedia_postId_position_idx" ON "PostMedia"("postId", "position");
CREATE INDEX "PostServiceAttachment_serviceId_idx" ON "PostServiceAttachment"("serviceId");
CREATE INDEX "PostProductAttachment_productId_idx" ON "PostProductAttachment"("productId");

ALTER TABLE "Post"
  ADD CONSTRAINT "Post_professionalProfileId_fkey"
  FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostMedia"
  ADD CONSTRAINT "PostMedia_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostServiceAttachment"
  ADD CONSTRAINT "PostServiceAttachment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostServiceAttachment"
  ADD CONSTRAINT "PostServiceAttachment_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PostProductAttachment"
  ADD CONSTRAINT "PostProductAttachment_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostProductAttachment"
  ADD CONSTRAINT "PostProductAttachment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostServiceAttachment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostProductAttachment" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON TYPE "PostStatus" TO hustle_api;
GRANT USAGE ON TYPE "PostMediaType" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Post" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PostMedia" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PostServiceAttachment" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PostProductAttachment" TO hustle_api;

CREATE POLICY "hustle_api_all_posts" ON "Post" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_post_media" ON "PostMedia" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_post_service_attachments" ON "PostServiceAttachment" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_post_product_attachments" ON "PostProductAttachment" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
