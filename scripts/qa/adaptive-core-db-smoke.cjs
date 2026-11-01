"use strict";
/* Runs ONLY against disposable local PostgreSQL in GitHub CI.
 * Do not add production credentials or point this at managed staging/production.
 */
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client");
const {AdaptiveService}=require("../../apps/api/dist/adaptive/adaptive.service");
const {AdaptiveRosterService}=require("../../apps/api/dist/adaptive/adaptive-roster.service");
const {BookingScheduleService}=require("../../apps/api/dist/booking/booking-schedule.service");
const {AdaptiveBookingOpsService}=require("../../apps/api/dist/adaptive/adaptive-booking-ops.service");

const url=new URL(process.env.DATABASE_URL||"postgresql://missing");
if(!["127.0.0.1","localhost"].includes(url.hostname) || !url.pathname.endsWith("/hustle_adaptive_ci"))
 throw Error("Refusing non-disposable database");
// Only after localhost / disposable-database guards: exercise feature-on roster reads.
process.env.HUSTLE_ADAPTIVE_CORE_ENABLED="true";
const db=new PrismaClient();
const api=new AdaptiveService(db);
const roster=new AdaptiveRosterService(db),schedule=new BookingScheduleService(db);
const ops=new AdaptiveBookingOpsService(db,schedule);
const id=(subject)=>({subject,emailVerified:true,phoneVerified:true});
const expectForbidden=async(promise,code=403)=>{
 await assert.rejects(promise,error=>typeof error?.getStatus==="function"&&error.getStatus()===code);
};
async function run(){
 const owner=await db.user.create({data:{authSubject:"adaptive-ci-owner",username:"adaptiveowner",
   capabilities:{create:[{capability:"CLIENT",status:"ACTIVE"},{capability:"HUSTLER",status:"ACTIVE"}]}}});
 const agent=await db.user.create({data:{authSubject:"adaptive-ci-agent",username:"adaptiveagent",
   capabilities:{create:[{capability:"CLIENT",status:"ACTIVE"},{capability:"AGENT",status:"ACTIVE"}]}}});
 const outsider=await db.user.create({data:{authSubject:"adaptive-ci-outsider",username:"adaptiveoutsider",
   capabilities:{create:{capability:"CLIENT",status:"ACTIVE"}}}});
 const own=id(owner.authSubject),member=id(agent.authSubject),other=id(outsider.authSubject);
 const p1=await api.provisionPersonal(own),p2=await api.provisionPersonal(own);
 assert.equal(p1.id,p2.id,"personal provisioning must be idempotent");
 const profile=await db.professionalProfile.create({data:{userId:owner.id}});
 const business=await api.createWorkspace(own,{name:"Sample Tailoring Studio",kind:"BUSINESS",category:"Tailoring"});
 assert.ok(business.id);
 assert.equal((await api.workspaces(member)).length,0,"agent should not have automatic access");
 await expectForbidden(api.services(other,business.id));
 const template=await api.draftService(own,business.id,{title:"Custom festival outfit",blueprint:"item",priceMinor:1800000,policy:{itemType:"tailoring",turnaroundHours:72,handoverMethods:["drop_off","home_pickup"],returnMethods:["shop_pickup","home_delivery"],measurementMethods:["shop_visit","guided_remote"],notifyWhenReady:true,needsClientApproval:true}});
 assert.equal(template.priceMinor,1800000);
 const list=await api.services(own,business.id);
 assert.equal(list.length,1);
 assert.equal(list[0].blueprint.slug,"item");
 assert.equal(template.policy.itemType,"tailoring");
 // Handoff uses canonical Service (not duplicate booking/money) and is idempotent.
 const prepared=await api.prepareCanonicalService(own,business.id,template.id);
 assert.equal(prepared.created,true);
 assert.equal(prepared.serviceStatus,"DRAFT");
 assert.equal(prepared.bookingMode,"WORK_QUEUE");
 const preparedAgain=await api.prepareCanonicalService(own,business.id,template.id);
 assert.equal(preparedAgain.created,false);
 assert.equal(preparedAgain.serviceId,prepared.serviceId);
 const canonical=await db.service.findUniqueOrThrow({where:{id:prepared.serviceId}});
 assert.equal(canonical.status,"DRAFT","handoff must never publish");
 assert.equal(canonical.professionalProfileId,(await db.professionalProfile.findUniqueOrThrow({where:{userId:owner.id}})).id);
 assert.equal(canonical.turnaroundHours,72);
 assert.equal((await db.adaptiveServiceDraft.findUniqueOrThrow({where:{id:template.id}})).canonicalServiceId,prepared.serviceId);
 await expectForbidden(api.prepareCanonicalService(other,business.id,template.id));
 // Existing account cannot use owner-only service handoff just by accepting an agent invitation.
 await expectForbidden(api.prepareCanonicalService(member,business.id,template.id));

 assert.deepEqual(template.policy.measurementMethods,["shop_visit","guided_remote"]);
 assert.equal(template.revision,1);
 // Appointment capacities cannot exceed staff/stations even in private drafts.
 await expectForbidden(api.draftService(own,business.id,{title:"Invalid salon slots",blueprint:"appointment",priceMinor:500000,
  policy:{availableProfessionals:2,availableStations:1,concurrentCapacity:3}}),400);
 await expectForbidden(api.draftService(own,business.id,{title:"Invalid consult credit",blueprint:"appointment",priceMinor:500000,
  policy:{consultationMode:"disabled",consultationFeeMinor:100000,creditConsultation:true}}),400);
 await expectForbidden(api.draftService(own,business.id,{title:"Unknown booking option",blueprint:"appointment",priceMinor:500000,
  policy:{escrowRelease:"automatic"}}),400);
 const salon=await api.draftService(own,business.id,{title:"Group wedding haircuts",blueprint:"appointment",priceMinor:800000,
  policy:{availableProfessionals:3,availableStations:2,concurrentCapacity:2,durationMinutes:30,
   consultationMode:"optional",consultationFeeMinor:100000,creditConsultation:true,homeService:true}});
 assert.equal(salon.policy.concurrentCapacity,2);
 const salonPrepared=await api.prepareCanonicalService(own,business.id,salon.id);
 const salonService=await db.service.findUniqueOrThrow({where:{id:salonPrepared.serviceId}});
 assert.equal(salonService.status,"DRAFT");
 assert.equal(salonService.bookingMode,"APPOINTMENT");
 assert.equal(salonService.parallelCapacity,2);
 assert.equal(salonService.overbookingAllowance,0);
 assert.deepEqual(salonService.weeklyHours,[],"appointments start with no bookable opening hours");
 assert.equal(salonService.resourcePoolKey,business.id);

 // A business with no configured roster remains in legacy FlowTime mode.
 const initial=await roster.list(own,business.id);
 assert.equal(initial.rosterEnabled,false);
 await expectForbidden(roster.create(other,business.id,{displayName:"Outsider",weeklyHours:[]}));
 const seven=Array.from({length:7},(_,day)=>({day,start:"09:00",end:"17:00"}));
 const worker1=(await roster.create(own,business.id,{displayName:"Ayo · Barber",weeklyHours:seven})).staff;
 const worker2=(await roster.create(own,business.id,{displayName:"Kunle · Barber",weeklyHours:seven})).staff;
 assert.equal((await roster.list(own,business.id)).activeStaff,2);
 await expectForbidden(roster.create(own,business.id,{displayName:"Invalid shifts",
   weeklyHours:[{day:1,start:"14:00",end:"10:00"}]}),400);
 await expectForbidden(roster.create(own,business.id,{displayName:"Overlapping shifts",
   weeklyHours:[{day:1,start:"09:00",end:"12:00"},{day:1,start:"11:00",end:"14:00"}]}),400);
 const settings=await roster.settings(own,business.id,{stationCapacity:2,rosterEnabled:true});
 assert.equal(settings.rosterEnabled,true);
 await expectForbidden(roster.settings(other,business.id,{stationCapacity:20,rosterEnabled:false}));
 // BookingScheduleService remains authoritative. Only scratch data is published here.
 await db.service.update({where:{id:salonPrepared.serviceId},data:{
   status:"PUBLISHED",weeklyHours:seven}});
 const day=new Date(Date.now()+8*86400000).toISOString().slice(0,10);
 const startAt=new Date(day+"T10:00:00+01:00"),endAt=new Date(day+"T10:30:00+01:00");
 const candidate={serviceId:salonPrepared.serviceId,startAt:startAt.toISOString(),endAt:endAt.toISOString()};
 let available=await schedule.checkAvailability(null,candidate);
 assert.equal(available.capacity,2);
 assert.equal(available.remainingCapacity,2);
 const leave=await roster.leave(own,business.id,worker2.id,{
   startAt:day+"T00:00:00+01:00",endAt:new Date(Date.parse(day+"T00:00:00Z")+86400000).toISOString().slice(0,10)+"T00:00:00+01:00",
   note:"Approved annual leave"
 });
 available=await schedule.checkAvailability(null,candidate);
 assert.equal(available.capacity,1,"one unavailable worker reduces real appointment capacity");
 assert.equal(available.remainingCapacity,1);
 // Real accepted booking (synthetic client) uses same shared pool and consumes the last seat.
 const accepted=await db.booking.create({data:{
   serviceId:salonPrepared.serviceId,clientUserId:outsider.id,hustlerUserId:owner.id,
   requestedStartAt:startAt,requestedEndAt:endAt,confirmedStartAt:startAt,confirmedEndAt:endAt,
   status:"ACCEPTED",requirements:"Synthetic test haircut",serviceTitleSnapshot:"Group wedding haircuts",
   agreedPriceMinor:800000,pricingTypeSnapshot:"FIXED"
 }});
 available=await schedule.checkAvailability(null,candidate);
 assert.equal(available.available,false);
 assert.equal(available.remainingCapacity,0,"last staffed slot is fully booked");
 const disabled=await roster.update(own,business.id,worker1.id,{
   displayName:worker1.displayName,weeklyHours:seven,active:false,expectedRevision:worker1.revision
 });
 assert.equal(disabled.staff.active,false);
 assert.ok(disabled.affectedExistingBookings>=1,"staff reduction flags pre-existing commitments for review");
 available=await schedule.checkAvailability(null,candidate);
 assert.equal(available.capacity,0);
 assert.equal(available.available,false);
 // Cancel time off and reactivate worker. A confirmed booking is not auto-deleted.
 await roster.cancelLeave(own,business.id,worker2.id,leave.leave.id);
 available=await schedule.checkAvailability(null,candidate);
 assert.equal(available.capacity,1);
 assert.equal(available.remainingCapacity,0);
 const reactivated=await roster.update(own,business.id,worker1.id,{
  displayName:worker1.displayName,weeklyHours:seven,active:true,expectedRevision:disabled.staff.revision
 });
 assert.equal(reactivated.staff.active,true);
 available=await schedule.checkAvailability(null,candidate);
 assert.equal(available.capacity,2);
 assert.equal(available.remainingCapacity,1);
 assert.equal((await db.booking.findUniqueOrThrow({where:{id:accepted.id}})).status,"ACCEPTED");
 // Stale, outsider and nonconsenting agent changes must fail.
 await expectForbidden(roster.update(own,business.id,worker1.id,{
  displayName:"Stale",weeklyHours:seven,active:true,expectedRevision:1}),409);
 await expectForbidden(roster.update(other,business.id,worker1.id,{
  displayName:"Wrong owner",weeklyHours:seven,active:true,expectedRevision:reactivated.staff.revision}));


 assert.equal(salon.policy.creditConsultation,true);
 const laundry=await api.draftService(own,business.id,{title:"Laundry pickup and delivery",blueprint:"item",priceMinor:450000,
  policy:{itemType:"laundry",handoverMethods:["home_pickup","drop_off"],
   returnMethods:["home_delivery","shop_pickup"],turnaroundHours:48,notifyWhenReady:true}});
 assert.equal(laundry.policy.itemType,"laundry");
 assert.equal(laundry.policy.notifyWhenReady,true);
 await expectForbidden(api.draftService(own,business.id,{title:"Laundry with body measurement",blueprint:"item",priceMinor:450000,
  policy:{itemType:"laundry",measurementMethods:["home_visit"]}}),400);
 const tutorial=await api.draftService(own,business.id,{title:"Five seat shoemaking tutorial",blueprint:"group",priceMinor:200000,
  policy:{maxParticipants:5,sessionCount:2,sessionMinutes:90}});
 assert.equal(tutorial.policy.maxParticipants,5);
 await expectForbidden(api.prepareCanonicalService(own,business.id,tutorial.id),400);
 const digital=await api.draftService(own,business.id,{title:"Digital portrait delivery",blueprint:"digital",priceMinor:250000,
  policy:{revisionRounds:3,estimatedDays:4}});
 assert.equal(digital.policy.revisionRounds,3);
 const edited=await api.updateServiceDraft(own,business.id,template.id,{
  expectedRevision:1,title:"Custom festival outfit plus fitting",priceMinor:1900000,
  policy:{itemType:"tailoring",measurementMethods:["guided_remote"],turnaroundHours:96}});
 assert.equal(edited.revision,2);
 assert.equal(edited.policy.turnaroundHours,96);
 assert.equal(edited.blueprint.slug,"item","blueprint identity cannot be silently swapped");
 await expectForbidden(api.updateServiceDraft(own,business.id,template.id,{
  expectedRevision:1,title:"Stale edit",priceMinor:100,policy:{itemType:"tailoring"}}),409);
 await expectForbidden(api.updateServiceDraft(other,business.id,template.id,{
  expectedRevision:2,title:"Cross-tenant hijack",priceMinor:100,policy:{itemType:"tailoring"}}));
 // Real concurrent revisions: exactly one caller may succeed.
 const competing=await Promise.allSettled([api.updateServiceDraft(own,business.id,template.id,{
  expectedRevision:2,title:"Edit A",priceMinor:2100000,policy:{itemType:"tailoring"}}),
 api.updateServiceDraft(own,business.id,template.id,{
  expectedRevision:2,title:"Edit B",priceMinor:2200000,policy:{itemType:"tailoring"}})]);
 assert.equal(competing.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(competing.filter(x=>x.status==="rejected").length,1);

 await expectForbidden(api.invite(own,business.id,{username:"adaptiveagent",role:"AGENT",permissions:["wallet.withdraw"]}),400);
 const invite=await api.invite(own,business.id,{username:"adaptiveagent",role:"AGENT",permissions:["work.manage"]});
 assert.equal(invite.status,"INVITED");
 await expectForbidden(api.services(member,business.id));
 await expectForbidden(api.respond(other,invite.id,true),409);
 await api.respond(member,invite.id,true);
 await expectForbidden(api.prepareCanonicalService(member,business.id,salon.id));
 await expectForbidden(api.updateServiceDraft(member,business.id,template.id,{
  expectedRevision:3,title:"Agent without service permission",priceMinor:30000,policy:{itemType:"tailoring"}}));

 assert.equal((await api.workspaces(member)).some(x=>x.workspace.id===business.id),true);
 const work=await api.draftWork(member,business.id,{title:"Sample outfit job",description:"Blue jacket, fitting required",serviceDraftId:template.id});
 assert.equal(work.status,"DRAFT");
 const hub=await api.workHub(own,business.id);
 assert.ok(hub.items.some(x=>x.id==="draft:"+work.id),"owner sees team draft");
 await expectForbidden(api.workHub(other,business.id));
 const cancelled=await api.cancelDraft(own,work.id,{expectedVersion:1});
 assert.equal(cancelled.version,2);assert.equal(cancelled.status,"CANCELLED");
 await expectForbidden(api.cancelDraft(own,work.id,{expectedVersion:1}),409);
 const event=await db.adaptiveWorkEvent.findMany({where:{workId:work.id},orderBy:{revision:"asc"}});
 assert.deepEqual(event.map(x=>x.revision),[1,2]);
 await api.revoke(own,business.id,invite.id);
 await expectForbidden(api.draftWork(member,business.id,{title:"No more access"}));

 // Assign exactly one eligible worker to each accepted appointment; last-slot
 // capacity and staff/leave were verified above by the same booking engine.
 const assigned=await ops.assign(own,business.id,accepted.id,{staffId:worker1.id});
 assert.equal(assigned.staffId,worker1.id);
 assert.equal((await ops.assign(own,business.id,accepted.id,{staffId:worker1.id})).revision,1);
 await expectForbidden(ops.assign(other,business.id,accepted.id,{staffId:worker2.id,expectedRevision:1}));
 const second=await db.booking.create({data:{
   serviceId:salonPrepared.serviceId,clientUserId:outsider.id,hustlerUserId:owner.id,
   requestedStartAt:startAt,requestedEndAt:endAt,confirmedStartAt:startAt,confirmedEndAt:endAt,
   status:"ACCEPTED",requirements:"Synthetic second haircut",serviceTitleSnapshot:"Group wedding haircuts",
   agreedPriceMinor:800000,pricingTypeSnapshot:"FIXED"
 }});
 await expectForbidden(ops.assign(own,business.id,second.id,{staffId:worker1.id}),409);
 assert.equal((await ops.assign(own,business.id,second.id,{staffId:worker2.id})).staffId,worker2.id);
 // Both assigned workers remain eligible, but one broken chair now leaves
 // two overlapping reservations competing for one physical station.
 assert.equal((await ops.staffingAlerts(own,business.id)).items.some(x=>x.capacityConflict),false);
 await roster.settings(own,business.id,{stationCapacity:1,rosterEnabled:true});
 const chairAlerts=await ops.staffingAlerts(own,business.id);
 for(const bookingId of [accepted.id,second.id]){
  const alert=chairAlerts.items.find(x=>x.bookingId===bookingId);
  assert.equal(alert.reason,"CAPACITY_CONFLICT");
  assert.equal(alert.capacity,1);
  assert.equal((await db.booking.findUniqueOrThrow({where:{id:bookingId}})).status,"ACCEPTED");
 }
 await roster.settings(own,business.id,{stationCapacity:2,rosterEnabled:true});
 assert.equal((await ops.staffingAlerts(own,business.id)).items.some(x=>x.capacityConflict),false);
 // A scheduler can review operational bookings but cannot progress item work.
 const schedulingInvite=await api.invite(own,business.id,{
  username:"adaptiveagent",role:"ASSISTANT",permissions:["schedule.manage"]});
 await api.respond(member,schedulingInvite.id,true);
 assert.ok((await ops.workspaceBookings(member,business.id)).some(x=>x.id===accepted.id));
 await ops.staffingAlerts(member,business.id);
 await expectForbidden(ops.itemProgress(member,business.id,accepted.id,{to:"RECEIVED",expectedRevision:1}));
 await api.revoke(own,business.id,schedulingInvite.id);
 await expectForbidden(ops.workspaceBookings(member,business.id));
 // A future-day break invalidates the previously usable shift without
 // silently cancelling or refunding an accepted booking.
 const later=new Date(Date.now()+12*86400000).toISOString().slice(0,10);
 const thirdStart=new Date(later+"T10:00:00+01:00");
 const thirdEnd=new Date(later+"T10:30:00+01:00");
 const third=await db.booking.create({data:{
   serviceId:salonPrepared.serviceId,clientUserId:outsider.id,hustlerUserId:owner.id,
   requestedStartAt:thirdStart,requestedEndAt:thirdEnd,confirmedStartAt:thirdStart,confirmedEndAt:thirdEnd,
   status:"ACCEPTED",requirements:"Weekend synthetic booking",serviceTitleSnapshot:"Group wedding haircuts",
   agreedPriceMinor:800000,pricingTypeSnapshot:"FIXED"
 }});
 await ops.assign(own,business.id,third.id,{staffId:worker1.id});
 const leaveAgain=await roster.leave(own,business.id,worker1.id,{
   startAt:later+"T00:00:00+01:00",
   endAt:new Date(Date.parse(later+"T00:00:00Z")+86400000).toISOString().slice(0,10)+"T00:00:00+01:00"
 });
 assert.ok(leaveAgain.affectedExistingBookings>=1);
 const reviewAfterLeave=await ops.staffingAlerts(own,business.id);
 assert.equal(reviewAfterLeave.rosterEnabled,true);
 assert.ok(reviewAfterLeave.items.some(x=>x.bookingId===third.id&&
   x.reason==="SHIFT_OR_LEAVE_CONFLICT"),"leave must flag a confirmed booking");
 await expectForbidden(ops.staffingAlerts(other,business.id));
 await expectForbidden(ops.staffingAlerts(member,business.id));
 assert.equal((await db.booking.findUniqueOrThrow({where:{id:third.id}})).status,"ACCEPTED");
 const reassigned=await ops.assign(own,business.id,third.id,{staffId:worker2.id,expectedRevision:1});
 assert.equal(reassigned.revision,2);
 const reviewAfterReassign=await ops.staffingAlerts(own,business.id);
 assert.equal(reviewAfterReassign.items.some(x=>x.bookingId===third.id),false,
   "manual reassignment resolves the specific worker conflict");
 await expectForbidden(ops.assign(own,business.id,third.id,{staffId:worker1.id,expectedRevision:2}),409);
 assert.equal((await ops.assign(own,business.id,third.id,{staffId:worker2.id,expectedRevision:1})).revision,2);
 assert.equal((await ops.myBookingSummary(other,third.id)).assignment.staff.displayName,worker2.displayName);

 // Explicitly configure this service's client-facing turnaround before
 // booking. Earlier concurrent draft edit fixtures intentionally reset it
 // to the 48-hour default; a snapshot must follow the current offer.
 await db.adaptiveServiceDraft.update({where:{id:template.id},data:{
  policy:{itemType:"tailoring",turnaroundHours:96,notifyWhenReady:true,
   handoverMethods:["drop_off","home_pickup"],
   returnMethods:["shop_pickup","home_delivery"],
   measurementMethods:["guided_remote"]}
 }});
 // Tailor item handover is selected by the CLIENT, not the business/agent.
 const garment=await db.booking.create({data:{
  serviceId:prepared.serviceId,clientUserId:outsider.id,hustlerUserId:owner.id,
  requestedStartAt:new Date(Date.now()+86400000),
  status:"PAYMENT_PENDING",requirements:"Synthetic dress fitting",
  serviceTitleSnapshot:"Custom festival outfit",agreedPriceMinor:1800000,pricingTypeSnapshot:"FIXED"
 }});
 await expectForbidden(ops.myHandover(own,garment.id,{intakeMethod:"drop_off",returnMethod:"shop_pickup"}),404);
 await expectForbidden(ops.myHandover(other,garment.id,{intakeMethod:"not_offered",returnMethod:"shop_pickup"}),400);
 const choices=await ops.myHandover(other,garment.id,{intakeMethod:"drop_off",returnMethod:"shop_pickup"});
 assert.equal(choices.status,"AWAITING_INTAKE");
 assert.equal(choices.policySnapshot.turnaroundHours,96);
 const revisedHandover=await ops.myHandover(other,garment.id,{
  intakeMethod:"home_pickup",returnMethod:"home_delivery",expectedRevision:1
 });
 assert.equal(revisedHandover.revision,2);
 assert.equal(revisedHandover.policySnapshot.turnaroundHours,96);
 await expectForbidden(ops.myHandover(other,garment.id,{
  intakeMethod:"drop_off",returnMethod:"shop_pickup",expectedRevision:1
 }),409);
 await ops.myHandover(other,garment.id,{
  intakeMethod:"drop_off",returnMethod:"shop_pickup",expectedRevision:2
 });
 // The client agreement is snapshotted; later unsynchronized business-draft
 // edits cannot silently change an accepted item's ETA or ready-notice policy.
 await db.adaptiveServiceDraft.update({where:{id:template.id},data:{
  policy:{itemType:"tailoring",turnaroundHours:500,notifyWhenReady:false}
 }});

 assert.equal((await ops.myBookingSummary(other,garment.id)).fulfillment.intakeMethod,"drop_off");
 assert.equal((await ops.myBookingSummary(other,garment.id)).fulfillment.policySnapshot.turnaroundHours,96);
 await expectForbidden(ops.itemProgress(own,business.id,garment.id,{to:"RECEIVED",expectedRevision:1}),409);
 await db.booking.update({where:{id:garment.id},data:{status:"FUNDED"}});
 await ops.itemProgress(own,business.id,garment.id,{to:"RECEIVED",expectedRevision:3});
 const receipt=await db.adaptiveItemFulfillment.findUniqueOrThrow({where:{bookingId:garment.id}});
 const hoursUntilReady=(receipt.estimatedReadyAt.getTime()-Date.now())/3600000;
 assert.ok(hoursUntilReady>95&&hoursUntilReady<97,"ETA reflects original 96-hour client terms, not later draft edits");

 // Owner can revise an estimate with a reason, preserving original agreed policy.
 const newEta=new Date(Date.now()+110*3600000).toISOString();
 await expectForbidden(ops.reviseReadyEstimate(other,business.id,garment.id,{
  estimatedReadyAt:newEta,reason:"Cloth delivery running late",expectedRevision:4
 }));
 await expectForbidden(ops.reviseReadyEstimate(own,business.id,garment.id,{
  estimatedReadyAt:newEta,reason:"Short",expectedRevision:4
 }),400);
 const etaChange=await ops.reviseReadyEstimate(own,business.id,garment.id,{
  estimatedReadyAt:newEta,reason:"Cloth delivery is delayed",expectedRevision:4
 });
 assert.equal(etaChange.revision,5);
 assert.equal(etaChange.estimatedReadyAt.toISOString(),newEta);
 assert.ok(await db.notification.findFirst({where:{recipientUserId:outsider.id,
  eventKey:"adaptive:item:"+garment.id+":ETA_REVISED:5"}}));
 assert.equal((await ops.myBookingSummary(other,garment.id)).fulfillment.events[0].details.reason,
  "Cloth delivery is delayed");
 await expectForbidden(ops.reviseReadyEstimate(own,business.id,garment.id,{
  estimatedReadyAt:new Date(Date.now()+111*3600000).toISOString(),
  reason:"Cloth delivery is delayed",expectedRevision:4
 }),409);
 assert.equal((await ops.reviseReadyEstimate(own,business.id,garment.id,{
  estimatedReadyAt:newEta,reason:"Cloth delivery is delayed",expectedRevision:4
 })).revision,5,"retrying identical estimate does not create a second event");


 await ops.itemProgress(own,business.id,garment.id,{to:"IN_PROGRESS",expectedRevision:5});
 const ready=await ops.itemProgress(own,business.id,garment.id,{to:"READY",expectedRevision:6});
 assert.equal(ready.status,"READY");
 assert.ok(ready.actualReadyAt);
 await expectForbidden(ops.itemProgress(own,business.id,garment.id,{to:"OUT_FOR_DELIVERY",expectedRevision:7}),409);
 const collected=await ops.itemProgress(own,business.id,garment.id,{to:"COLLECTED",expectedRevision:7});
 assert.equal(collected.status,"COLLECTED");
 await expectForbidden(ops.confirmItemReceived(own,garment.id,{expectedRevision:8}),404);
 const receiptConfirmed=await ops.confirmItemReceived(other,garment.id,{expectedRevision:8});
 assert.ok(receiptConfirmed.clientConfirmedAt);
 assert.equal(receiptConfirmed.revision,9);
 assert.equal((await ops.confirmItemReceived(other,garment.id,{expectedRevision:8})).revision,9,
  "duplicate client confirmation is idempotent");
 assert.ok(await db.notification.findFirst({where:{recipientUserId:owner.id,
   eventKey:"adaptive:item:"+garment.id+":CLIENT_RECEIVED"}}));

 await expectForbidden(ops.itemProgress(own,business.id,garment.id,{to:"COLLECTED",expectedRevision:7}),409);
 assert.ok(await db.notification.findFirst({where:{recipientUserId:outsider.id,
  eventKey:"adaptive:item:"+garment.id+":READY:7"}}));
 assert.equal((await db.booking.findUniqueOrThrow({where:{id:garment.id}})).status,"FUNDED",
  "item notifications do not advance the financial Booking");
 assert.equal((await db.adaptiveItemEvent.findMany({where:{fulfillmentId:collected.id}})).length,6);
 // Laundry can offer home pickup and delivery, without claiming automatic courier dispatch.
 const laundryPrepared=await api.prepareCanonicalService(own,business.id,laundry.id);
 const wash=await db.booking.create({data:{
  serviceId:laundryPrepared.serviceId,clientUserId:outsider.id,hustlerUserId:owner.id,
  requestedStartAt:new Date(Date.now()+86400000),status:"FUNDED",
  requirements:"Synthetic wash",serviceTitleSnapshot:"Laundry pickup and delivery",
  agreedPriceMinor:450000,pricingTypeSnapshot:"FIXED"
 }});
 await ops.myHandover(other,wash.id,{intakeMethod:"home_pickup",returnMethod:"home_delivery"});
 await ops.itemProgress(own,business.id,wash.id,{to:"RECEIVED",expectedRevision:1});
 await ops.itemProgress(own,business.id,wash.id,{to:"IN_PROGRESS",expectedRevision:2});
 await ops.itemProgress(own,business.id,wash.id,{to:"READY",expectedRevision:3});
 await ops.itemProgress(own,business.id,wash.id,{to:"OUT_FOR_DELIVERY",expectedRevision:4});
 await ops.itemProgress(own,business.id,wash.id,{to:"DELIVERED",expectedRevision:5});
 await expectForbidden(ops.confirmItemReceived(other,wash.id,{expectedRevision:4}),409);
 const deliveredReceipt=await ops.confirmItemReceived(other,wash.id,{expectedRevision:6});
 assert.ok(deliveredReceipt.clientConfirmedAt);
 assert.equal(deliveredReceipt.revision,7);
 assert.equal((await db.booking.findUniqueOrThrow({where:{id:wash.id}})).status,"FUNDED");

 assert.ok(await db.notification.findFirst({where:{recipientUserId:outsider.id,
  eventKey:"adaptive:item:"+wash.id+":READY:4"}}));
 assert.equal((await db.booking.findUniqueOrThrow({where:{id:wash.id}})).status,"FUNDED");

 // Canonical Booking/Order remain unmodified and visible only to authenticated participants.

 const service=await db.service.create({data:{professionalProfileId:profile.id,title:"Sample haircut",priceMinor:5000,currency:"NGN",pricingType:"FIXED"}});
 const booking=await db.booking.create({data:{serviceId:service.id,clientUserId:outsider.id,hustlerUserId:owner.id,
   requestedStartAt:new Date(Date.now()+86400000),requirements:"Short fade",serviceTitleSnapshot:"Sample haircut",
   agreedPriceMinor:5000,currency:"NGN",pricingTypeSnapshot:"FIXED"}});
 const order=await db.order.create({data:{buyerUserId:outsider.id,sellerUserId:owner.id,subtotalMinor:5000,totalMinor:5000}});
 const ownerHub=await api.workHub(own);
 const clientHub=await api.workHub(other);
 assert.ok(ownerHub.items.some(x=>x.id==="booking:"+booking.id));
 assert.ok(clientHub.items.some(x=>x.id==="booking:"+booking.id));
 assert.ok(ownerHub.items.some(x=>x.id==="order:"+order.id));
 assert.ok(clientHub.items.some(x=>x.id==="order:"+order.id));
 assert.equal((await db.booking.findUnique({where:{id:booking.id}})).status,"REQUESTED");
 assert.equal((await db.order.findUnique({where:{id:order.id}})).status,"PENDING");
 const agentHub=await api.workHub(member);
 assert.equal(agentHub.items.some(x=>x.id==="booking:"+booking.id),false,"agent is not a direct booking party");
 // Review pagination never silently drops bookings beyond the first page.
 const pageFixtures=Array.from({length:52},(_,i)=>({
  id:"adaptive-page-"+String(i).padStart(3,"0"),serviceId:salonPrepared.serviceId,
  clientUserId:outsider.id,hustlerUserId:owner.id,
  requestedStartAt:thirdStart,confirmedStartAt:thirdStart,confirmedEndAt:thirdEnd,
  status:"ACCEPTED",requirements:"Pagination fixture",serviceTitleSnapshot:"Pagination appointment",
  agreedPriceMinor:0,pricingTypeSnapshot:"FIXED"
 }));
 await db.booking.createMany({data:pageFixtures});
 const seen=new Set();let cursor;
 do{
  const page=await ops.staffingAlerts(own,business.id,cursor);
  for(const alert of page.items){assert.equal(seen.has(alert.bookingId),false);seen.add(alert.bookingId);}
  cursor=page.nextCursor;
 }while(cursor);
 assert.ok(pageFixtures.every(x=>seen.has(x.id)),"every paged reservation is reviewable");
 process.stdout.write("Adaptive disposable Postgres: workspace, consent, revocation, CAS, legacy work isolation PASS\n");
}
run().catch(e=>{process.stderr.write(String(e.stack||e)+"\n");process.exitCode=1}).finally(()=>db.$disconnect());
