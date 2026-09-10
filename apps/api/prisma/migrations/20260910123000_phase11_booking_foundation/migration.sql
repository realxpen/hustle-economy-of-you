CREATE TYPE "BookingStatus" AS ENUM (
  'REQUESTED',
  'ACCEPTED',
  'DECLINED',
  'PAYMENT_PENDING',
  'FUNDED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'DISPUTED',
  'REFUNDED',
  'CLOSED'
);

CREATE TABLE "Booking" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "clientUserId" TEXT NOT NULL,
  "hustlerUserId" TEXT NOT NULL,
  "conversationId" TEXT,
  "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedStartAt" TIMESTAMP(3) NOT NULL,
  "requestedEndAt" TIMESTAMP(3),
  "confirmedStartAt" TIMESTAMP(3),
  "confirmedEndAt" TIMESTAMP(3),
  "requirements" TEXT NOT NULL,
  "location" TEXT,
  "notes" TEXT,
  "serviceTitleSnapshot" TEXT NOT NULL,
  "agreedPriceMinor" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "pricingTypeSnapshot" "ServicePricingType" NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "paymentPendingAt" TIMESTAMP(3),
  "fundedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "cancelledByUserId" TEXT,
  "declineReason" TEXT,
  "cancellationReason" TEXT,
  "disputedAt" TIMESTAMP(3),
  "refundedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Booking_distinct_participants_check" CHECK ("clientUserId" <> "hustlerUserId"),
  CONSTRAINT "Booking_requested_schedule_check" CHECK ("requestedEndAt" IS NULL OR "requestedEndAt" > "requestedStartAt"),
  CONSTRAINT "Booking_confirmed_schedule_check" CHECK (
    ("confirmedStartAt" IS NULL AND "confirmedEndAt" IS NULL)
    OR ("confirmedStartAt" IS NOT NULL AND ("confirmedEndAt" IS NULL OR "confirmedEndAt" > "confirmedStartAt"))
  ),
  CONSTRAINT "Booking_requirements_check" CHECK (char_length(btrim("requirements")) BETWEEN 1 AND 4000),
  CONSTRAINT "Booking_location_check" CHECK ("location" IS NULL OR char_length(btrim("location")) BETWEEN 1 AND 300),
  CONSTRAINT "Booking_notes_check" CHECK ("notes" IS NULL OR char_length(btrim("notes")) BETWEEN 1 AND 2000),
  CONSTRAINT "Booking_service_title_snapshot_check" CHECK (char_length(btrim("serviceTitleSnapshot")) BETWEEN 1 AND 300),
  CONSTRAINT "Booking_price_check" CHECK ("agreedPriceMinor" >= 0),
  CONSTRAINT "Booking_currency_check" CHECK (char_length("currency") = 3),
  CONSTRAINT "Booking_decline_reason_check" CHECK ("declineReason" IS NULL OR char_length(btrim("declineReason")) BETWEEN 1 AND 1000),
  CONSTRAINT "Booking_cancellation_reason_check" CHECK ("cancellationReason" IS NULL OR char_length(btrim("cancellationReason")) BETWEEN 1 AND 1000),
  CONSTRAINT "Booking_cancel_actor_check" CHECK (
    ("cancelledAt" IS NULL AND "cancelledByUserId" IS NULL)
    OR ("cancelledAt" IS NOT NULL AND "cancelledByUserId" IS NOT NULL)
  )
);

CREATE INDEX "Booking_clientUserId_status_createdAt_idx" ON "Booking"("clientUserId", "status", "createdAt");
CREATE INDEX "Booking_hustlerUserId_status_createdAt_idx" ON "Booking"("hustlerUserId", "status", "createdAt");
CREATE INDEX "Booking_serviceId_status_requestedStartAt_idx" ON "Booking"("serviceId", "status", "requestedStartAt");
CREATE INDEX "Booking_conversationId_idx" ON "Booking"("conversationId");
CREATE INDEX "Booking_status_createdAt_idx" ON "Booking"("status", "createdAt");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_clientUserId_fkey"
  FOREIGN KEY ("clientUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_hustlerUserId_fkey"
  FOREIGN KEY ("hustlerUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_cancelledByUserId_fkey"
  FOREIGN KEY ("cancelledByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Booking" ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON TYPE "BookingStatus" TO hustle_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Booking" TO hustle_api;

CREATE POLICY "hustle_api_all_bookings"
ON "Booking"
FOR ALL
TO hustle_api
USING (true)
WITH CHECK (true);
