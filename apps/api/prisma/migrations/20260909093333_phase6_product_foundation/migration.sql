CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'DIGITAL');
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED');

CREATE TABLE "Product" (
  "id" TEXT NOT NULL,
  "professionalProfileId" TEXT NOT NULL,
  "title" TEXT,
  "description" TEXT,
  "category" TEXT,
  "mediaUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "type" "ProductType" NOT NULL DEFAULT 'PHYSICAL',
  "priceMinor" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "trackInventory" BOOLEAN NOT NULL DEFAULT false,
  "inventoryQuantity" INTEGER,
  "deliveryInformation" TEXT,
  "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Product_priceMinor_nonnegative" CHECK ("priceMinor" IS NULL OR "priceMinor" >= 0),
  CONSTRAINT "Product_inventoryQuantity_nonnegative" CHECK ("inventoryQuantity" IS NULL OR "inventoryQuantity" >= 0)
);

CREATE TABLE "ProductVariant" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "optionValues" JSONB,
  "priceOverrideMinor" INTEGER,
  "inventoryQuantity" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProductVariant_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductVariant_priceOverrideMinor_nonnegative" CHECK ("priceOverrideMinor" IS NULL OR "priceOverrideMinor" >= 0),
  CONSTRAINT "ProductVariant_inventoryQuantity_nonnegative" CHECK ("inventoryQuantity" IS NULL OR "inventoryQuantity" >= 0)
);

CREATE INDEX "Product_professionalProfileId_status_idx" ON "Product"("professionalProfileId", "status");
CREATE INDEX "Product_status_category_idx" ON "Product"("status", "category");
CREATE INDEX "Product_createdAt_idx" ON "Product"("createdAt");
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");
CREATE UNIQUE INDEX "ProductVariant_productId_sku_key" ON "ProductVariant"("productId", "sku");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_professionalProfileId_fkey"
FOREIGN KEY ("professionalProfileId") REFERENCES "ProfessionalProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductVariant"
ADD CONSTRAINT "ProductVariant_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProductVariant" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Product" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ProductVariant" TO hustle_api;

CREATE POLICY hustle_api_product_all
ON "Product"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);

CREATE POLICY hustle_api_product_variant_all
ON "ProductVariant"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
