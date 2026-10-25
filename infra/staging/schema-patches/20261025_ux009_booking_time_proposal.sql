-- UX009: durable, Client-actionable alternate schedule on an existing booking.
-- Additive only; older API revisions can still read/write existing booking fields.
CREATE TYPE "BookingTimeProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

ALTER TABLE "Booking"
  ADD COLUMN "timeProposalId" TEXT,
  ADD COLUMN "timeProposalStatus" "BookingTimeProposalStatus",
  ADD COLUMN "timeProposalStartAt" TIMESTAMP(3),
  ADD COLUMN "timeProposalEndAt" TIMESTAMP(3),
  ADD COLUMN "timeProposalNote" TEXT,
  ADD COLUMN "timeProposalCreatedAt" TIMESTAMP(3),
  ADD COLUMN "timeProposalRespondedAt" TIMESTAMP(3);

-- Valid state never leaves a pending proposal with no identity or start time.
ALTER TABLE "Booking"
 ADD CONSTRAINT "Booking_time_proposal_consistent"
 CHECK ("timeProposalStatus" IS NULL OR
   ("timeProposalId" IS NOT NULL AND "timeProposalStartAt" IS NOT NULL AND "timeProposalCreatedAt" IS NOT NULL));
