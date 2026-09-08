CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');
CREATE TYPE "ServicePricingType" AS ENUM ('FIXED', 'STARTING_AT', 'HOURLY');
CREATE TYPE "ServiceDeliveryMode" AS ENUM ('REMOTE', 'PHYSICAL', 'BOTH');

CREATE TABLE "Service" (
  "id" TEXT NOT NULL,
  "professionalProfileId" TEXT NOT NULL,
  "title" TEXT,
  "category" TEXT,
  "description" TEXT,
  "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "priceMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "pricingType" "ServicePricingType" NOT NULL DEFAULT 'FIXED',
  "deliveryMode" "ServiceDeliveryMode" NOT NULL DEFAULT 'REMOTE',
  "location" TEXT,
  "availabilityNote" TEXT,
  "deliveryTime" TEXT,
  "requirements" TEXT,
  "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Service_professionalProfileId_status_idx" ON "Service"("professionalProfileId", "status");
CREATE INDEX "Service_status_category_idx" ON "Service"("status", "category");
CREATE INDEX "Service_createdAt_idx" ON "Service"("createdAt");

ALTER TABLE "Service"
ADD CONSTRAINT "Service_professionalProfileId_fkey"
FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Service" TO hustle_api;

CREATE POLICY hustle_api_service_all
ON "Service"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
