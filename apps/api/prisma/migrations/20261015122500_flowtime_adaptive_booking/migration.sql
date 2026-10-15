-- FlowTime additive migration. Existing bookings and finance records are preserved.
-- Deployment requires an explicit owner-reviewed migration; never apply to live automatically.
CREATE TYPE "BookingOperationMode" AS ENUM ('APPOINTMENT', 'WORK_QUEUE', 'CONSULTATION');

ALTER TABLE "Service"
  ADD COLUMN "bookingMode" "BookingOperationMode" NOT NULL DEFAULT 'APPOINTMENT',
  ADD COLUMN "bookingTimezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
  ADD COLUMN "resourcePoolKey" TEXT NOT NULL DEFAULT 'primary',
  ADD COLUMN "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "prepMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "parallelCapacity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "overbookingAllowance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "weeklyHours" JSONB,
  ADD COLUMN "blackoutDates" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "maxActiveJobs" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "turnaroundHours" INTEGER NOT NULL DEFAULT 48,
  ADD COLUMN "autoExtensionMinutes" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Booking"
  ADD COLUMN "scheduledDurationMinutes" INTEGER,
  ADD COLUMN "extendedMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "actualStartedAt" TIMESTAMP(3),
  ADD COLUMN "actualFinishedAt" TIMESTAMP(3);

CREATE TABLE "BookingScheduleRevision" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "previousEndAt" TIMESTAMP(3),
  "newEndAt" TIMESTAMP(3) NOT NULL,
  "addedMinutes" INTEGER NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingScheduleRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingScheduleRevision_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BookingScheduleRevision_bookingId_createdAt_idx" ON "BookingScheduleRevision"("bookingId","createdAt");
CREATE INDEX "Booking_hustlerUserId_status_confirmedStartAt_idx" ON "Booking"("hustlerUserId","status","confirmedStartAt");
CREATE INDEX "Service_professionalProfileId_resourcePoolKey_idx" ON "Service"("professionalProfileId","resourcePoolKey");

ALTER TABLE "Service"
  ADD CONSTRAINT "flowtime_positive_policy" CHECK (
    "defaultDurationMinutes" BETWEEN 5 AND 1440 AND
    "prepMinutes" BETWEEN 0 AND 120 AND
    "bufferMinutes" BETWEEN 0 AND 180 AND
    "parallelCapacity" BETWEEN 1 AND 100 AND
    "overbookingAllowance" BETWEEN 0 AND 10 AND
    "maxActiveJobs" BETWEEN 1 AND 10000 AND
    "turnaroundHours" BETWEEN 1 AND 8760 AND
    "autoExtensionMinutes" BETWEEN 0 AND 120
  );
