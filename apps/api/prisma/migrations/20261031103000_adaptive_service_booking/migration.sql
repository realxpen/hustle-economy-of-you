-- Adaptive booking foundation. Reviewed PR only; never auto-apply to production.
-- Existing services remain optional consultation, one-person appointments and unchanged prices.
ALTER TABLE "Service"
  ADD COLUMN "consultationPolicy" TEXT NOT NULL DEFAULT 'OPTIONAL',
  ADD COLUMN "consultationFeeMinor" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "consultationCreditEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "groupBookingsEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Booking"
  ADD COLUMN "partySize" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "consultationRequested" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "referenceUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Service"
  ADD CONSTRAINT "service_consultation_config_valid" CHECK (
    "consultationPolicy" IN ('OFF', 'OPTIONAL', 'REQUIRED')
    AND "consultationFeeMinor" BETWEEN 0 AND 10000000
    AND ("consultationPolicy" <> 'OFF' OR
      ("consultationFeeMinor" = 0 AND "consultationCreditEnabled" = false))
  );
ALTER TABLE "Booking"
  ADD CONSTRAINT "booking_party_size_valid" CHECK ("partySize" BETWEEN 1 AND 50);
