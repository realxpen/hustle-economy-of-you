-- Additive service-level consultation and group booking metadata.
-- Historical bookings default to one client and no consultation request.
-- Do not apply to production without owner-reviewed migration/acceptance.
CREATE TYPE "ConsultationPolicy" AS ENUM ('OFF', 'OPTIONAL', 'REQUIRED');

ALTER TABLE "Service"
  ADD COLUMN "consultationPolicy" "ConsultationPolicy" NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "consultationFeeMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "consultationCreditEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "maxPartySize" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Booking"
  ADD COLUMN "partySize" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "venueType" TEXT,
  ADD COLUMN "referenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "consultationRequested" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "Service"
  ADD CONSTRAINT "service_consultation_amount_valid" CHECK ("consultationFeeMinor" BETWEEN 0 AND 2000000000),
  ADD CONSTRAINT "service_party_size_valid" CHECK ("maxPartySize" BETWEEN 1 AND 50),
  ADD CONSTRAINT "service_disabled_consultation_free" CHECK (
    "consultationPolicy" <> 'OFF' OR ("consultationFeeMinor" = 0 AND "consultationCreditEnabled" = FALSE)
  );

ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_party_size_valid" CHECK ("partySize" BETWEEN 1 AND 50),
  ADD CONSTRAINT "booking_venue_type_valid" CHECK (
    "venueType" IS NULL OR "venueType" IN ('AT_PROVIDER','AT_CLIENT','EVENT','REMOTE')
  ),
  ADD CONSTRAINT "booking_references_count_valid" CHECK (cardinality("referenceUrls") <= 5);

-- Deliberate finance boundary: consultation fee is a published policy,
-- not a charge, payment proof, credit, escrow hold or invoice adjustment.
