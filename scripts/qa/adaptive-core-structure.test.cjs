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
  assert.match(moduleSource,/imports:\s*\[AuthModule\]/);
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
