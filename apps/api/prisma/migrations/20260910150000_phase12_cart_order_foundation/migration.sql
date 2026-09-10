CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE "OrderInventorySource" AS ENUM ('NONE', 'PRODUCT', 'VARIANT');

CREATE TABLE "Cart" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Cart_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "CartItem" (
  "id" TEXT NOT NULL,
  "cartId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "itemKey" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99),
  CONSTRAINT "CartItem_item_key_check" CHECK (char_length(btrim("itemKey")) > 0)
);

CREATE TABLE "Order" (
  "id" TEXT NOT NULL,
  "buyerUserId" TEXT NOT NULL,
  "sellerUserId" TEXT NOT NULL,
  "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "subtotalMinor" INTEGER NOT NULL,
  "totalMinor" INTEGER NOT NULL,
  "deliveryName" TEXT,
  "deliveryPhone" TEXT,
  "deliveryAddress" TEXT,
  "deliveryCity" TEXT,
  "deliveryState" TEXT,
  "deliveryCountry" TEXT,
  "deliveryNote" TEXT,
  "paymentReference" TEXT,
  "paidAt" TIMESTAMP(3),
  "processingAt" TIMESTAMP(3),
  "shippedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Order_amount_check" CHECK ("subtotalMinor" >= 0 AND "totalMinor" >= 0),
  CONSTRAINT "Order_total_check" CHECK ("totalMinor" >= "subtotalMinor"),
  CONSTRAINT "Order_participants_check" CHECK ("buyerUserId" <> "sellerUserId"),
  CONSTRAINT "Order_currency_check" CHECK (char_length(btrim("currency")) BETWEEN 3 AND 12)
);

CREATE TABLE "OrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVariantId" TEXT,
  "productTitleSnapshot" TEXT NOT NULL,
  "variantNameSnapshot" TEXT,
  "skuSnapshot" TEXT,
  "optionValuesSnapshot" JSONB,
  "productTypeSnapshot" "ProductType" NOT NULL,
  "unitPriceMinor" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "lineTotalMinor" INTEGER NOT NULL,
  "inventorySource" "OrderInventorySource" NOT NULL DEFAULT 'NONE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99),
  CONSTRAINT "OrderItem_price_check" CHECK ("unitPriceMinor" >= 0 AND "lineTotalMinor" >= 0),
  CONSTRAINT "OrderItem_line_total_check" CHECK (("unitPriceMinor"::BIGINT * "quantity"::BIGINT) = "lineTotalMinor"::BIGINT),
  CONSTRAINT "OrderItem_title_check" CHECK (char_length(btrim("productTitleSnapshot")) > 0),
  CONSTRAINT "OrderItem_variant_inventory_check" CHECK ("inventorySource" <> 'VARIANT' OR "productVariantId" IS NOT NULL)
);

CREATE UNIQUE INDEX "Cart_userId_key" ON "Cart"("userId");
CREATE INDEX "Cart_updatedAt_idx" ON "Cart"("updatedAt");
CREATE UNIQUE INDEX "CartItem_cartId_itemKey_key" ON "CartItem"("cartId", "itemKey");
CREATE INDEX "CartItem_cartId_createdAt_idx" ON "CartItem"("cartId", "createdAt");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
CREATE INDEX "CartItem_productVariantId_idx" ON "CartItem"("productVariantId");
CREATE UNIQUE INDEX "Order_paymentReference_key" ON "Order"("paymentReference");
CREATE INDEX "Order_buyerUserId_status_createdAt_idx" ON "Order"("buyerUserId", "status", "createdAt");
CREATE INDEX "Order_sellerUserId_status_createdAt_idx" ON "Order"("sellerUserId", "status", "createdAt");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX "OrderItem_orderId_createdAt_idx" ON "OrderItem"("orderId", "createdAt");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_productVariantId_idx" ON "OrderItem"("productVariantId");

ALTER TABLE "Cart"
  ADD CONSTRAINT "Cart_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_cartId_fkey"
  FOREIGN KEY ("cartId") REFERENCES "Cart"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_buyerUserId_fkey"
  FOREIGN KEY ("buyerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_sellerUserId_fkey"
  FOREIGN KEY ("sellerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productVariantId_fkey"
  FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Cart" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CartItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON TYPE "OrderStatus" TO hustle_api;
GRANT USAGE ON TYPE "OrderInventorySource" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Cart" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "CartItem" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Order" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "OrderItem" TO hustle_api;

CREATE POLICY "hustle_api_all_carts" ON "Cart" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_cart_items" ON "CartItem" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_orders" ON "Order" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
CREATE POLICY "hustle_api_all_order_items" ON "OrderItem" FOR ALL TO hustle_api USING (true) WITH CHECK (true);
