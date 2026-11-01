-- UNAPPLIED PROPOSAL: preserve the 41-entry Prisma migration gate.
-- Intentionally NOT located in apps/api/prisma/migrations.
-- Promote only after offline rehearsal, migration-history approval and founder sign-off.

-- Additive Prisma migration proposal for Hustle's existing public schema.
-- NEVER APPLY TO PRODUCTION WITHOUT REVIEW/BACKUP/PREVIEW ACCEPTANCE.
-- Existing User/Booking/Order and finance/agent/Auth tables remain authoritative.
CREATE TYPE "AdaptiveWorkspaceKind" AS ENUM ('PERSONAL','BUSINESS','TEAM','AGENCY');
CREATE TYPE "AdaptiveMemberRole" AS ENUM ('OWNER','MANAGER','WORKER','AGENT','ASSISTANT','ACCOUNTANT');
CREATE TYPE "AdaptiveMemberStatus" AS ENUM ('INVITED','ACTIVE','REVOKED');
CREATE TYPE "AdaptiveWorkflowType" AS ENUM ('APPOINTMENT','ITEM','PROJECT','GROUP','EVENT','PRODUCT','DIGITAL','RECURRING','LIVE');
CREATE TYPE "AdaptiveWorkStatus" AS ENUM ('DRAFT','REQUESTED','ACCEPTED','IN_PROGRESS','READY','DELIVERED','REVIEW','COMPLETED','DISPUTED','CANCELLED');

CREATE TABLE "AdaptiveWorkspace" (
 "id" TEXT PRIMARY KEY,
 "ownerUserId" TEXT NOT NULL,
 "name" TEXT NOT NULL,
 "slug" TEXT NOT NULL,
 "kind" "AdaptiveWorkspaceKind" NOT NULL DEFAULT 'BUSINESS',
 "category" TEXT,
 "city" TEXT,
 "stationCapacity" INTEGER NOT NULL DEFAULT 1,
 "rosterEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AdaptiveWorkspace_ownerUserId_slug_key" ON "AdaptiveWorkspace" ("ownerUserId","slug");
CREATE INDEX "AdaptiveWorkspace_ownerUserId_kind_idx" ON "AdaptiveWorkspace" ("ownerUserId","kind");
ALTER TABLE "AdaptiveWorkspace" ADD CONSTRAINT "AdaptiveWorkspace_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AdaptiveMembership" (
 "id" TEXT PRIMARY KEY,
 "workspaceId" TEXT NOT NULL,
 "userId" TEXT NOT NULL,
 "invitedById" TEXT NOT NULL,
 "role" "AdaptiveMemberRole" NOT NULL,
 "status" "AdaptiveMemberStatus" NOT NULL DEFAULT 'INVITED',
 "permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
 "acceptedAt" TIMESTAMP(3),
 "revokedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdaptiveMembership_workspaceId_userId_key" ON "AdaptiveMembership" ("workspaceId","userId");
CREATE INDEX "AdaptiveMembership_userId_status_idx" ON "AdaptiveMembership" ("userId","status");
ALTER TABLE "AdaptiveMembership" ADD CONSTRAINT "AdaptiveMembership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AdaptiveWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveMembership" ADD CONSTRAINT "AdaptiveMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveMembership" ADD CONSTRAINT "AdaptiveMembership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveMembership" ADD CONSTRAINT "AdaptiveMembership_active_has_consent" CHECK ("status" <> 'ACTIVE' OR "acceptedAt" IS NOT NULL);

CREATE TABLE "AdaptiveBlueprint" (
 "id" TEXT PRIMARY KEY,
 "slug" TEXT NOT NULL,
 "version" INTEGER NOT NULL,
 "type" "AdaptiveWorkflowType" NOT NULL,
 "definition" JSONB NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdaptiveBlueprint_slug_version_key" ON "AdaptiveBlueprint" ("slug","version");
ALTER TABLE "AdaptiveBlueprint" ADD CONSTRAINT "AdaptiveBlueprint_version_positive" CHECK ("version" > 0);

CREATE TABLE "AdaptiveServiceDraft" (
 "id" TEXT PRIMARY KEY,
 "workspaceId" TEXT NOT NULL,
 "blueprintId" TEXT NOT NULL,
 "title" TEXT NOT NULL,
 "priceMinor" INTEGER NOT NULL DEFAULT 0,
 "currency" TEXT NOT NULL DEFAULT 'NGN',
 "canonicalServiceId" TEXT,
 "policy" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AdaptiveServiceDraft_canonicalServiceId_key" ON "AdaptiveServiceDraft" ("canonicalServiceId");
CREATE INDEX "AdaptiveServiceDraft_workspaceId_updatedAt_idx" ON "AdaptiveServiceDraft" ("workspaceId","updatedAt");
ALTER TABLE "AdaptiveServiceDraft" ADD CONSTRAINT "AdaptiveServiceDraft_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AdaptiveWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveServiceDraft" ADD CONSTRAINT "AdaptiveServiceDraft_canonicalServiceId_fkey" FOREIGN KEY ("canonicalServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdaptiveServiceDraft" ADD CONSTRAINT "AdaptiveServiceDraft_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "AdaptiveBlueprint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveServiceDraft" ADD CONSTRAINT "AdaptiveServiceDraft_revision_positive" CHECK ("revision" > 0);
ALTER TABLE "AdaptiveServiceDraft" ADD CONSTRAINT "AdaptiveServiceDraft_price_nonnegative" CHECK ("priceMinor" >= 0);
ALTER TABLE "AdaptiveServiceDraft" ADD CONSTRAINT "AdaptiveServiceDraft_title_length" CHECK (length("title") BETWEEN 3 AND 150);

CREATE TABLE "AdaptiveWorkRecord" (
 "id" TEXT PRIMARY KEY,
 "workspaceId" TEXT NOT NULL,
 "serviceDraftId" TEXT,
 "clientUserId" TEXT NOT NULL,
 "bookingId" TEXT,
 "orderId" TEXT,
 "title" TEXT NOT NULL,
 "status" "AdaptiveWorkStatus" NOT NULL DEFAULT 'DRAFT',
 "version" INTEGER NOT NULL DEFAULT 1,
 "requirements" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "agreement" JSONB,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AdaptiveWorkRecord_bookingId_key" ON "AdaptiveWorkRecord" ("bookingId");
CREATE UNIQUE INDEX "AdaptiveWorkRecord_orderId_key" ON "AdaptiveWorkRecord" ("orderId");
CREATE INDEX "AdaptiveWorkRecord_workspaceId_status_updatedAt_idx" ON "AdaptiveWorkRecord" ("workspaceId","status","updatedAt");
CREATE INDEX "AdaptiveWorkRecord_clientUserId_createdAt_idx" ON "AdaptiveWorkRecord" ("clientUserId","createdAt");
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AdaptiveWorkspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_serviceDraftId_fkey" FOREIGN KEY ("serviceDraftId") REFERENCES "AdaptiveServiceDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_only_one_legacy_source" CHECK (NOT ("bookingId" IS NOT NULL AND "orderId" IS NOT NULL));
ALTER TABLE "AdaptiveWorkRecord" ADD CONSTRAINT "AdaptiveWorkRecord_version_positive" CHECK ("version" > 0);

CREATE TABLE "AdaptiveWorkEvent" (
 "id" TEXT PRIMARY KEY,
 "workId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL,
 "actorUserId" TEXT NOT NULL,
 "eventType" TEXT NOT NULL,
 "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdaptiveWorkEvent_workId_revision_key" ON "AdaptiveWorkEvent" ("workId","revision");
CREATE INDEX "AdaptiveWorkEvent_actorUserId_createdAt_idx" ON "AdaptiveWorkEvent" ("actorUserId","createdAt");
ALTER TABLE "AdaptiveWorkEvent" ADD CONSTRAINT "AdaptiveWorkEvent_workId_fkey" FOREIGN KEY ("workId") REFERENCES "AdaptiveWorkRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveWorkEvent" ADD CONSTRAINT "AdaptiveWorkEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deny direct browser/PostgREST writes. Access via authenticated Nest API
-- with explicit workspace membership checks. Supabase project grant settings
-- must be reviewed against existing public schema policies before applying.
DO $$
DECLARE name text;
BEGIN
 FOREACH name IN ARRAY ARRAY[
   'AdaptiveWorkspace','AdaptiveMembership','AdaptiveBlueprint',
   'AdaptiveServiceDraft','AdaptiveWorkRecord','AdaptiveWorkEvent'
 ] LOOP
   EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',name);
   EXECUTE format('REVOKE ALL ON TABLE %I FROM anon, authenticated',name);
 END LOOP;
END $$;


-- Staff are business scheduling resources, not authenticated users or payment recipients.
CREATE TABLE "AdaptiveStaffMember" (
 "id" TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL,
 "displayName" TEXT NOT NULL, "active" BOOLEAN NOT NULL DEFAULT TRUE,
 "weeklyHours" JSONB NOT NULL DEFAULT '[]'::jsonb,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "AdaptiveStaffMember_workspaceId_active_idx" ON "AdaptiveStaffMember" ("workspaceId","active");
ALTER TABLE "AdaptiveStaffMember" ADD CONSTRAINT "AdaptiveStaffMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "AdaptiveWorkspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveStaffMember" ADD CONSTRAINT "AdaptiveStaffMember_revision_positive" CHECK ("revision" > 0);
CREATE TABLE "AdaptiveStaffLeave" (
 "id" TEXT PRIMARY KEY, "staffId" TEXT NOT NULL,
 "startAt" TIMESTAMP(3) NOT NULL, "endAt" TIMESTAMP(3) NOT NULL,
 "note" TEXT, "cancelledAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdaptiveStaffLeave_staffId_startAt_endAt_idx" ON "AdaptiveStaffLeave" ("staffId","startAt","endAt");
ALTER TABLE "AdaptiveStaffLeave" ADD CONSTRAINT "AdaptiveStaffLeave_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdaptiveStaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveStaffLeave" ADD CONSTRAINT "AdaptiveStaffLeave_valid_interval" CHECK ("startAt" < "endAt");
ALTER TABLE "AdaptiveWorkspace" ADD CONSTRAINT "AdaptiveWorkspace_stationCapacity_positive" CHECK ("stationCapacity" BETWEEN 1 AND 200);

-- Deny browser/PostgREST access (server-side authenticated Nest endpoints only).
ALTER TABLE "AdaptiveStaffMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdaptiveStaffLeave" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AdaptiveStaffMember" FROM anon, authenticated;
REVOKE ALL ON TABLE "AdaptiveStaffLeave" FROM anon, authenticated;


-- Canonical booking operational assignments and item progress. ADDITIVE,
-- UNAPPLIED proposal only. No changes to existing Booking or Payment tables.
CREATE TYPE "AdaptiveItemStage" AS ENUM (
 'AWAITING_INTAKE','RECEIVED','IN_PROGRESS','READY',
 'OUT_FOR_DELIVERY','DELIVERED','COLLECTED'
);
CREATE TABLE "AdaptiveBookingAssignment" (
 "id" TEXT PRIMARY KEY,
 "bookingId" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "staffId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AdaptiveBookingAssignment_bookingId_key" ON "AdaptiveBookingAssignment"("bookingId");
CREATE INDEX "AdaptiveBookingAssignment_workspaceId_staffId_idx" ON "AdaptiveBookingAssignment"("workspaceId","staffId");
ALTER TABLE "AdaptiveBookingAssignment" ADD CONSTRAINT "AdaptiveBookingAssignment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveBookingAssignment" ADD CONSTRAINT "AdaptiveBookingAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "AdaptiveStaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveBookingAssignment" ADD CONSTRAINT "AdaptiveBookingAssignment_revision_positive" CHECK("revision" > 0);

CREATE TABLE "AdaptiveItemFulfillment" (
 "id" TEXT PRIMARY KEY,
 "bookingId" TEXT NOT NULL,
 "workspaceId" TEXT NOT NULL,
 "intakeMethod" TEXT NOT NULL,
 "returnMethod" TEXT NOT NULL,
 "policySnapshot" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "status" "AdaptiveItemStage" NOT NULL DEFAULT 'AWAITING_INTAKE',
 "estimatedReadyAt" TIMESTAMP(3),
 "actualReadyAt" TIMESTAMP(3),
 "clientConfirmedAt" TIMESTAMP(3),
 "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "AdaptiveItemFulfillment_bookingId_key" ON "AdaptiveItemFulfillment"("bookingId");
CREATE INDEX "AdaptiveItemFulfillment_workspaceId_status_idx" ON "AdaptiveItemFulfillment"("workspaceId","status");
ALTER TABLE "AdaptiveItemFulfillment" ADD CONSTRAINT "AdaptiveItemFulfillment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveItemFulfillment" ADD CONSTRAINT "AdaptiveItemFulfillment_revision_positive" CHECK("revision" > 0);
CREATE TABLE "AdaptiveItemEvent" (
 "id" TEXT PRIMARY KEY,
 "fulfillmentId" TEXT NOT NULL,
 "revision" INTEGER NOT NULL,
 "eventType" TEXT NOT NULL,
 "details" JSONB NOT NULL DEFAULT '{}'::jsonb,
 "actorUserId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdaptiveItemEvent_fulfillmentId_revision_key" ON "AdaptiveItemEvent"("fulfillmentId","revision");
ALTER TABLE "AdaptiveItemEvent" ADD CONSTRAINT "AdaptiveItemEvent_fulfillmentId_fkey" FOREIGN KEY ("fulfillmentId") REFERENCES "AdaptiveItemFulfillment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveBookingAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdaptiveItemFulfillment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdaptiveItemEvent" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AdaptiveBookingAssignment","AdaptiveItemFulfillment","AdaptiveItemEvent" FROM anon, authenticated;


-- Optional GROUP appointment reservation ledger, unapplied until reviewed.
-- A group occupies peopleCount units in one canonical paid/unpaid Booking.
CREATE TABLE "AdaptiveGroupBooking" (
 "id" TEXT PRIMARY KEY, "bookingId" TEXT NOT NULL, "workspaceId" TEXT NOT NULL,
 "peopleCount" INTEGER NOT NULL, "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "AdaptiveGroupBooking_count_bounds" CHECK ("peopleCount" BETWEEN 2 AND 12),
 CONSTRAINT "AdaptiveGroupBooking_revision_positive" CHECK ("revision" > 0)
);
CREATE UNIQUE INDEX "AdaptiveGroupBooking_bookingId_key" ON "AdaptiveGroupBooking"("bookingId");
CREATE INDEX "AdaptiveGroupBooking_workspaceId_createdAt_idx" ON "AdaptiveGroupBooking"("workspaceId","createdAt");
ALTER TABLE "AdaptiveGroupBooking" ADD CONSTRAINT "AdaptiveGroupBooking_bookingId_fkey"
 FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "AdaptiveGroupStaffAssignment" (
 "id" TEXT PRIMARY KEY, "groupId" TEXT NOT NULL, "staffId" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "AdaptiveGroupStaffAssignment_groupId_staffId_key"
 ON "AdaptiveGroupStaffAssignment"("groupId","staffId");
CREATE INDEX "AdaptiveGroupStaffAssignment_staffId_idx" ON "AdaptiveGroupStaffAssignment"("staffId");
ALTER TABLE "AdaptiveGroupStaffAssignment" ADD CONSTRAINT "AdaptiveGroupStaffAssignment_groupId_fkey"
 FOREIGN KEY ("groupId") REFERENCES "AdaptiveGroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveGroupStaffAssignment" ADD CONSTRAINT "AdaptiveGroupStaffAssignment_staffId_fkey"
 FOREIGN KEY ("staffId") REFERENCES "AdaptiveStaffMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptiveGroupBooking" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdaptiveGroupStaffAssignment" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "AdaptiveGroupBooking","AdaptiveGroupStaffAssignment" FROM anon,authenticated;
