"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const repo = path.resolve(__dirname, "../..");
const read = name => fs.readFileSync(path.join(repo,name), "utf8");
const schema = read("apps/api/prisma/schema.prisma");
const sql = read("backend-readiness/adaptive-v1/prisma-migration-proposal.sql");
const guard = read("apps/api/src/adaptive/adaptive-feature.guard.ts");
const service = read("apps/api/src/adaptive/adaptive.service.ts");
const ctrl = read("apps/api/src/adaptive/adaptive.controller.ts");
const moduleSource = read("apps/api/src/adaptive/adaptive.module.ts");
const workPage = read("apps/web/app/economy/page.tsx");
const apiClient = read("apps/web/lib/adaptive.ts");
test("Prisma extension preserves existing account, booking, order and agent models",()=>{
  for(const name of ["User","UserCapability","AgentRelationship","Service","Booking","Order","PaymentAttempt","EscrowRecord"])
    assert.match(schema,new RegExp("model "+name+" \\{"));
});
test("Adaptive workspace/member/blueprint/service/work/event models exist",()=>{
  for(const name of ["AdaptiveWorkspace","AdaptiveMembership","AdaptiveBlueprint","AdaptiveServiceDraft","AdaptiveWorkRecord","AdaptiveWorkEvent"])
    assert.match(schema,new RegExp("model "+name+" \\{"));
});
test("New work links existing booking/order without duplicating financial ledgers",()=>{
  assert.match(schema,/bookingId\s+String\?\s+@unique/);
  assert.match(schema,/orderId\s+String\?\s+@unique/);
  assert.doesNotMatch(sql,/DROP TABLE|TRUNCATE|ALTER TABLE "(?:Booking|Order|User|PaymentAttempt|EscrowRecord)"/i);
});
test("Actor identity derives from existing AuthGuard and User.authSubject",()=>{
  assert.match(ctrl,/@UseGuards\(AuthGuard, AdaptiveFeatureGuard\)/);
  assert.match(service,/where:\s*\{\s*authSubject:\s*identity\.subject/);
  assert.match(moduleSource,/imports:\s*\[AuthModule(?:,\s*BookingModule)?\]/);
});
test("Adaptive routes fail closed without independent feature flag",()=>{
  assert.match(guard,/process\.env\.HUSTLE_ADAPTIVE_CORE_ENABLED !== "true"/);
  assert.match(guard,/ServiceUnavailableException/);
});
test("Invites require different actor consent before member activation",()=>{
  assert.match(service,/status:\s*AdaptiveMemberStatus\.INVITED/);
  assert.match(service,/userId:\s*user\.id,\s*status:\s*AdaptiveMemberStatus\.INVITED/);
  assert.match(service,/status:\s*AdaptiveMemberStatus\.ACTIVE,\s*acceptedAt:\s*new Date/);
});
test("Owner only can invite/revoke; approved agent capability enforced",()=>{
  assert.match(service,/space\.ownerUserId !== user\.id/);
  assert.match(service,/Capability\.AGENT && c\.status === CapabilityStatus\.ACTIVE/);
  assert.match(service,/userId:\s*\{\s*not:\s*user\.id\s*\}/);
});
test("No delegated payout, escrow release, identity or owner controls",()=>{
  const policy=read("apps/api/src/adaptive/adaptive-blueprints.ts");
  assert.match(policy,/WORKSPACE_PERMISSIONS/);
  for(const name of ["wallet.withdraw","escrow.release","payout.change","identity.approve"])assert.doesNotMatch(policy,new RegExp(name.replace(".","\\.")));
});
test("Work draft cancellation checks revision and writes event atomically",()=>{
  assert.match(service,/version,\s*status:\s*AdaptiveWorkStatus\.DRAFT/);
  assert.match(service,/version:\s*\{\s*increment:\s*1\s*\}/);
  assert.match(service,/eventType:\s*"work\.draft_cancelled"/);
  assert.match(service,/this\.db\.\$transaction/);
});
test("Work Hub reads authoritative legacy Booking/Order records scoped by actor",()=>{
  assert.match(service,/this\.db\.booking\.findMany/);
  assert.match(service,/this\.db\.order\.findMany/);
  assert.match(service,/clientUserId:\s*user\.id/);
  assert.match(service,/hustlerUserId:\s*user\.id/);
  assert.match(service,/buyerUserId:\s*user\.id/);
  assert.match(service,/sellerUserId:\s*user\.id/);
  assert.match(service,/canWrite:\s*false/);
});
test("Migration does not expose new tables to browser roles",()=>{
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/REVOKE ALL ON TABLE/);
  assert.match(sql,/FROM anon, authenticated/);
});
test("Web page uses the authenticated adapter and no browser-memory fallback",()=>{
  assert.match(apiClient,/authenticatedFetch/);
  assert.match(workPage,/adaptiveClient\.workspaces\(\)/);
  assert.match(workPage,/Backend activation is still gated/);
  assert.doesNotMatch(workPage,/localStorage|sessionStorage|demoFixture/);
});


test("Service policy uses strict blueprint-specific server validation",()=>{
  const rules=read("apps/api/src/adaptive/adaptive-service-policy.ts");
  assert.match(rules,/validateAdaptiveServicePolicy/);
  assert.match(rules,/concurrentCapacity/);
  assert.match(rules,/availableProfessionals/);
  assert.match(rules,/consultationFeeMinor/);
  assert.match(rules,/turnaroundHours/);
  assert.match(rules,/measurementMethods/);
  assert.match(rules,/Unknown .* policy field/);
});
test("Service edits use scoped authorization and compare-and-set revisions",()=>{
  assert.match(service,/async updateServiceDraft/);
  assert.match(service,/this\.membership\(user\.id, workspaceId, "services\.manage"\)/);
  assert.match(service,/revision: expectedRevision/);
  assert.match(service,/revision: \{ increment: 1 \}/);
  assert.match(ctrl,/@Patch\("workspaces\/:workspaceId\/services\/:draftId"\)/);
});
test("New draft revision is represented in Prisma and migration proposal",()=>{
  assert.match(schema,/revision\s+Int\s+@default\(1\)/);
  assert.match(sql,/"revision" INTEGER NOT NULL DEFAULT 1/);
  assert.match(sql,/AdaptiveServiceDraft_revision_positive/);
});

test("Canonical service handoff reuses Booking authority and stays owner only",()=>{
  assert.match(service,/async prepareCanonicalService/);
  assert.match(service,/workspace\.ownerUserId !== user\.id/);
  assert.match(service,/approved\?\.status !== CapabilityStatus\.ACTIVE/);
  assert.match(service,/FOR UPDATE/);
  assert.match(service,/status: ServiceStatus\.DRAFT/);
  assert.match(service,/weeklyHours: \[\]/);
  assert.match(ctrl,/@Post\("workspaces\/:workspaceId\/services\/:draftId\/prepare-canonical"\)/);
  assert.doesNotMatch(service.slice(service.indexOf("async prepareCanonicalService"),service.indexOf("async draftWork")),/tx\.booking\.create|tx\.paymentAttempt\.create|tx\.escrowRecord\.create/);
});
test("One-to-one canonical link is proposed but not activated",()=>{
  assert.match(schema,/canonicalServiceId\s+String\?\s+@unique/);
  assert.match(sql,/"canonicalServiceId" TEXT/);
  assert.match(sql,/AdaptiveServiceDraft_canonicalServiceId_fkey/);
});

test("Staff roster is private, scope-aware and shares the Booking lock",()=>{
 const roster=read("apps/api/src/adaptive/adaptive-roster.service.ts");
 const ctrl=read("apps/api/src/adaptive/adaptive.controller.ts");
 const scheduling=read("apps/api/src/booking/booking-schedule.service.ts");
 assert.match(roster,/schedule\.manage/);
 assert.match(roster,/AdaptiveMemberStatus\.ACTIVE/);
 assert.match(roster,/pg_try_advisory_xact_lock/);
 assert.match(roster,/affectedExistingBookings/);
 assert.match(roster,/revision:\{increment:1\}/);
 assert.match(ctrl,/@Get\("workspaces\/:workspaceId\/roster"\)/);
 assert.match(ctrl,/@Post\("workspaces\/:workspaceId\/staff"\)/);
 assert.match(scheduling,/HUSTLE_ADAPTIVE_CORE_ENABLED === "true"/);
 assert.doesNotMatch(scheduling.slice(scheduling.indexOf("const scheduleSelect"),scheduling.indexOf("type SchedulingService")),/adaptiveDraft/);
 assert.match(scheduling,/rosterCapacity\(/);
 assert.match(scheduling,/roster\?\.rosterEnabled/);
});
test("Roster tables and capacity flag are additive, RLS-blocked and proposed only",()=>{
 const proposal=read("backend-readiness/adaptive-v1/prisma-migration-proposal.sql");
 assert.match(schema,/model AdaptiveStaffMember/);
 assert.match(schema,/model AdaptiveStaffLeave/);
 assert.match(schema,/rosterEnabled\s+Boolean\s+@default\(false\)/);
 assert.match(proposal,/ENABLE ROW LEVEL SECURITY/);
 assert.match(proposal,/REVOKE ALL ON TABLE "AdaptiveStaffMember"/);
});

test("Operational booking routes enforce scoped shifts, version and owner locks",()=>{
 const ops=read("apps/api/src/adaptive/adaptive-booking-ops.service.ts");
 const ctrl=read("apps/api/src/adaptive/adaptive.controller.ts");
 assert.match(ops,/pg_try_advisory_xact_lock/);
 assert.match(ops,/staffCoversSlot/);
 assert.match(ops,/already assigned to an overlapping appointment/);
 assert.match(ops,/revision:\{increment:1\}/);
 assert.match(ops,/user\.id!==b\.clientUserId/);
 assert.match(ops,/work\.manage/);
 assert.match(ctrl,/@Post\("bookings\/:bookingId\/handover"\)/);
 assert.match(ctrl,/@Post\("workspaces\/:workspaceId\/bookings\/:bookingId\/assign"\)/);
 assert.match(ctrl,/@Post\("workspaces\/:workspaceId\/bookings\/:bookingId\/item-progress"\)/);
});
test("Ready notifications are in-app and never modify Booking or financial state",()=>{
 const ops=read("apps/api/src/adaptive/adaptive-booking-ops.service.ts");
 assert.match(ops,/NotificationKind\.BOOKING/);
 assert.match(ops,/expectedRevision/);
 assert.match(ops,/actualReadyAt/);
 assert.match(ops,/estimatedReadyAt/);
 assert.match(ops,/NotificationKind\.BOOKING/);
 assert.doesNotMatch(ops,/tx\.escrow|tx\.paymentAttempt|tx\.financialLedger|tx\.booking\.update/);
});
test("Assignment and item progress relations are private and additive",()=>{
 const proposal=read("backend-readiness/adaptive-v1/prisma-migration-proposal.sql");
 assert.match(schema,/model AdaptiveBookingAssignment/);
 assert.match(schema,/model AdaptiveItemFulfillment/);
 assert.match(schema,/model AdaptiveItemEvent/);
 assert.match(proposal,/AdaptiveBookingAssignment_bookingId_key/);
 assert.match(proposal,/AdaptiveItemFulfillment_bookingId_key/);
 assert.match(proposal,/REVOKE ALL ON TABLE "AdaptiveBookingAssignment"/);
});

test("Staffing review is scoped and never changes accepted financial Booking records",()=>{
 const ops=read("apps/api/src/adaptive/adaptive-booking-ops.service.ts");
 const ctrl=read("apps/api/src/adaptive/adaptive.controller.ts");
 assert.match(ops,/async staffingAlerts/);
 assert.match(ops,/schedule\.manage/);
 assert.match(ops,/SHIFT_OR_LEAVE_CONFLICT/);
 assert.match(ops,/WORKER_INACTIVE/);
 assert.match(ops,/UNASSIGNED/);
 assert.match(ctrl,/@Get\("workspaces\/:workspaceId\/staffing-alerts"\)/);
 const block=ops.slice(ops.indexOf("async staffingAlerts("),ops.indexOf("async assign("));
 assert.doesNotMatch(block,/\.update\(|\.updateMany\(|\.create\(/);
});
test("Client item contract snapshots survive edits and stale writes are rejected",()=>{
 const ops=read("apps/api/src/adaptive/adaptive-booking-ops.service.ts");
 assert.match(ops,/prev\?\.policySnapshot/);
 assert.match(ops,/revision:expected,status:AdaptiveItemStage\.AWAITING_INTAKE/);
 assert.match(ops,/if\(changed\.count!==1\)/);
});

test("ETA revisions and client receipt are scoped, versioned and do not release escrow",()=>{
 const ops=read("apps/api/src/adaptive/adaptive-booking-ops.service.ts");
 const ctrl=read("apps/api/src/adaptive/adaptive.controller.ts");
 assert.match(ops,/async reviseReadyEstimate/);
 assert.match(ops,/async confirmItemReceived/);
 assert.match(ops,/Only this business can revise its item-service estimate/);
 assert.match(ops,/only be acknowledged after delivery or collection/);
 assert.match(ops,/item\.eta_revised/);
 assert.match(ops,/item\.client_received/);
 assert.match(ops,/revision:expected/);
 assert.match(ops,/NotificationKind\.BOOKING/);
 assert.match(ctrl,/@Post\("bookings\/:bookingId\/confirm-item-receipt"\)/);
 assert.match(ctrl,/@Post\("workspaces\/:workspaceId\/bookings\/:bookingId\/estimate"\)/);
 const segment=ops.slice(ops.indexOf("async reviseReadyEstimate("),ops.indexOf("async itemProgress("));
 assert.doesNotMatch(segment,/tx\.booking\.update|tx\.paymentAttempt|tx\.escrow/);
});
test("Receipt timestamp and ETA audit fields are added only in private schema proposal",()=>{
 const sql=read("backend-readiness/adaptive-v1/prisma-migration-proposal.sql");
 assert.match(schema,/clientConfirmedAt\s+DateTime\?/);
 assert.match(schema,/details\s+Json\s+@default\("\{\}"\)/);
 assert.match(sql,/"clientConfirmedAt" TIMESTAMP\(3\)/);
 assert.match(sql,/"details" JSONB NOT NULL/);
});

test("Group booking holds simultaneous capacity only under feature flag",()=>{
 const sched=read("apps/api/src/booking/booking-schedule.service.ts");
 const booking=read("apps/api/src/booking/booking.service.ts");
 const groups=read("apps/api/src/adaptive/adaptive-group.service.ts");
 assert.match(sched,/acceptedGroupUnits/);
 assert.match(sched,/change: units/);
 assert.match(sched,/remaining >= requestedUnits/);
 assert.match(sched,/HUSTLE_ADAPTIVE_CORE_ENABLED === "true"/);
 assert.match(booking,/tx\.adaptiveGroupBooking\.create/);
 assert.match(booking,/peopleCount>1&&process\.env\.HUSTLE_ADAPTIVE_CORE_ENABLED/);
 assert.match(groups,/pg_try_advisory_xact_lock/);
 assert.match(groups,/staffCoversSlot/);
 assert.match(groups,/group\.revision!==input\.expectedRevision/);
 assert.match(groups,/adaptiveGroupStaffAssignment\.createMany/);
});
test("Group assignments do not alter Booking price, escrow or payment",()=>{
 const g=read("apps/api/src/adaptive/adaptive-group.service.ts");
 assert.doesNotMatch(g,/tx\.booking\.update|tx\.escrow|tx\.paymentAttempt|tx\.financialLedger/);
 assert.match(schema,/model AdaptiveGroupBooking/);
 assert.match(schema,/model AdaptiveGroupStaffAssignment/);
 assert.match(sql,/AdaptiveGroupBooking_count_bounds/);
 assert.match(sql,/REVOKE ALL ON TABLE "AdaptiveGroupBooking"/);
});

test("Delivery objections use one authoritative marketplace case and freeze canonical booking",()=>{
 const cases=read("apps/api/src/adaptive/adaptive-item-casework.service.ts");
 const controller=read("apps/api/src/adaptive/adaptive.controller.ts");
 const existing=read("apps/api/src/admin-operations/marketplace-case.service.ts");
 assert.match(cases,/tx\\.marketplaceCase\\.create/);
 assert.match(cases,/MarketplaceCaseSubjectType\\.BOOKING/);
 assert.match(cases,/status: BookingStatus\\.DISPUTED/);
 assert.match(cases,/clientConfirmedAt: null/);
 assert.match(cases,/revision: \\{ increment: 1 \\}/);
 assert.match(cases,/item\\.delivery_claim_opened/);
 assert.match(cases,/item\\.delivery_statement/);
 assert.match(cases,/NotificationKind\\.BOOKING/);
 assert.match(existing,/deliveryEvidence/);
 assert.match(controller,/@Get\\("bookings\\/:bookingId\\/delivery-case"\\)/);
 assert.match(controller,/@Post\\("bookings\\/:bookingId\\/delivery-case\\/open"\\)/);
 assert.match(controller,/@Post\\("bookings\\/:bookingId\\/delivery-case\\/statements"\\)/);
 assert.doesNotMatch(cases,/tx\\.escrowRecord\\.(?:create|update)|tx\\.paymentAttempt\\.(?:create|update)|tx\\.wallet/);
 assert.doesNotMatch(schema,/model AdaptiveDeliveryDispute/);
});
test("Delivery-case UI uses guarded participant reads without access to admin notes",()=>{
 const source=read("apps/web/components/economy/item-delivery-case.tsx");
 const handover=read("apps/web/components/economy/client-item-handover.tsx");
 const client=read("apps/web/lib/adaptive.ts");
 const backend=read("apps/api/src/adaptive/adaptive-item-casework.service.ts");
 assert.match(client,/authenticatedFetch/);
 assert.match(client,/deliveryCase:/);
 assert.match(client,/openDeliveryCase:/);
 assert.match(client,/deliveryStatement:/);
 assert.match(source,/record\\.canOpen/);
 assert.match(source,/record\\.canRespond/);
 assert.match(source,/Not independently verified/);
 assert.match(handover,/state\\.bookingStatus!==\\"DISPUTED\\"/);
 assert.match(handover,/ItemDeliveryCase/);
 assert.doesNotMatch(backend,/marketplaceCaseNote\\.(?:create|findMany)/);
 assert.match(backend,/actorId === booking\\.clientUserId/);
});
