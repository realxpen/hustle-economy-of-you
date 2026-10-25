#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const schema=get("apps/api/prisma/schema.prisma");
const migration=get("infra/staging/schema-patches/20261025_ux009_booking_time_proposal.sql");
const service=get("apps/api/src/booking/booking.service.ts");
const controller=get("apps/api/src/booking/booking.controller.ts");
const web=get("apps/web/app/bookings/[bookingId]/page.tsx");
const client=get("apps/web/lib/booking.ts");
const list=get("apps/web/app/bookings/page.tsx");
const css=get("apps/web/app/bookings/bookings.module.css");
const apiGate=get("apps/api/src/staging-request-policy.ts");
const proxy=get("apps/web/lib/api/isolated-web-proxy.ts");
assert.match(schema,/enum BookingTimeProposalStatus \{\s+PENDING\s+ACCEPTED\s+DECLINED/);
for(const field of ["timeProposalId","timeProposalStatus","timeProposalStartAt","timeProposalEndAt",
 "timeProposalNote","timeProposalCreatedAt","timeProposalRespondedAt"]){
 assert.match(schema,new RegExp(field+"\\s"));
 assert.match(migration,new RegExp('ADD COLUMN "'+field+'"'));
 assert.match(service,new RegExp(field+": true"));
 assert.match(client,new RegExp(field+": "));
}
assert.match(migration,/Booking_time_proposal_consistent/);
assert.match(controller,/@Post\(":bookingId\/propose-time"\)/);
assert.match(controller,/@Post\(":bookingId\/respond-time"\)/);
assert.match(controller,/@UseGuards\(AuthGuard\)/);
assert.match(service,/async proposeTime\(identity: AuthIdentity/);
assert.match(service,/await this\.requireActiveHustler\(viewer\.id\)/);
assert.match(service,/booking\.hustlerUserId !== viewer\.id/);
assert.match(service,/async respondTime\(identity: AuthIdentity/);
assert.match(service,/current\.clientUserId !== viewer\.id/);
assert.match(service,/input\.decision !== "ACCEPT" && input\.decision !== "DECLINE"/);
assert.match(service,/timeProposalId: proposalId, timeProposalStatus: BookingTimeProposalStatus\.PENDING/);
assert.match(service,/if \(result\.count !== 1\) throw new ConflictException\("Proposal has already been answered"\)/);
assert.match(service,/\.\$queryRaw`SELECT "id" FROM "Booking" WHERE "id" = \$\{id\} FOR UPDATE`/);
assert.match(service,/booking\.timeProposalStatus === BookingTimeProposalStatus\.PENDING/);
assert.match(service,/requestedStartAt: start, requestedEndAt: end/);
assert.match(service,/await this\.schedule\.checkAvailability\(identity/);
assert.match(service,/await tx\.notification\.createMany/);
assert.match(service,/kind: NotificationKind\.BOOKING/);
assert.match(service,/eventKey: `booking:time:\$\{id\}:\$\{proposalId\}:proposed`/);
assert.match(service,/eventKey: `booking:time:\$\{id\}:\$\{proposalId\}:\$\{approved \? "accepted" : "declined"\}`/);
assert.doesNotMatch(service.slice(service.indexOf("async proposeTime"),service.indexOf("async extend(")),/(?:tx\.(?:wallet|escrow)|BookingStatus\.PAYMENT_PENDING|paymentPendingAt\s*:|fundedAt\s*:)/);
assert.match(web,/proposeBookingTime\(booking\.id/);
assert.match(web,/respondToBookingTime\(booking\.id/);
assert.match(web,/Accept proposed time/);
assert.match(web,/Decline proposed time/);
assert.match(web,/Refresh proposal status/);
assert.match(web,/booking\.viewerRole === "CLIENT"/);
assert.match(web,/booking\.timeProposalStatus === "PENDING"/);
assert.doesNotMatch(web,/sendMessage\(booking\.conversationId/);
assert.match(list,/needsTimeResponse/);
assert.match(list,/New time proposed — Accept or decline/);
assert.match(css,/\.timeProposalPanel/);
assert.match(css,/\.proposalActions/);
const load=(p)=>{
 const location=path.join(root,p),m=new Module(location,module);m.filename=location;
 m.paths=Module._nodeModulePaths(path.dirname(location));
 m._compile(ts.transpileModule(get(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,location);
 return m.exports;
};
const api=load("apps/api/src/staging-request-policy.ts");
const app=load("apps/web/lib/api/isolated-web-proxy.ts");
for(const method of ["propose-time","respond-time"]){
 const url="/api/v1/bookings/booking123/"+method;
 assert.equal(api.stagingRequestAllowed("POST",url),true);
 assert.equal(app.stagingProxyAllowed("POST",url.slice(1).split("/")),true);
 for(const denied of ["GET","DELETE","PUT"]){
  assert.equal(api.stagingRequestAllowed(denied,url),false);
  assert.equal(app.stagingProxyAllowed(denied,url.slice(1).split("/")),false);
 }
}
for(const url of ["/api/v1/bookings/id123/start","/api/v1/bookings/id123/complete",
 "/api/v1/bookings/id123/extend","/api/v1/payments/initialize"]){
 assert.equal(api.stagingRequestAllowed("POST",url),false);
 assert.equal(app.stagingProxyAllowed("POST",url.slice(1).split("/")),false);
}
console.log("PASS: UX009 persistent, role-scoped, compare-and-swap Client scheduling consent and safe isolated proxy routes");
