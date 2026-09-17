-- Phase 16A: temporary 24-hour Stories.
-- Story ownership and optional commerce attachment authority are enforced by the API.

CREATE TYPE "StoryType" AS ENUM ('TEXT', 'IMAGE', 'VIDEO');

CREATE TABLE "Story" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "StoryType" NOT NULL,
  "text" TEXT,
  "mediaUrl" TEXT,
  "background" TEXT,
  "serviceId" TEXT,
  "productId" TEXT,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Story_expiresAt_publishedAt_idx" ON "Story"("expiresAt", "publishedAt");
CREATE INDEX "Story_userId_expiresAt_idx" ON "Story"("userId", "expiresAt");
CREATE INDEX "Story_serviceId_idx" ON "Story"("serviceId");
CREATE INDEX "Story_productId_idx" ON "Story"("productId");
