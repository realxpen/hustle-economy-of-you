"use strict";
/* Runs ONLY against disposable local PostgreSQL in GitHub CI.
 * Do not add production credentials or point this at managed staging/production.
 */
const assert=require("node:assert/strict");
const {PrismaClient}=require("@prisma/client");
const {AdaptiveService}=require("../../apps/api/dist/adaptive/adaptive.service");

const url=new URL(process.env.DATABASE_URL||"postgresql://missing");
if(!["127.0.0.1","localhost"].includes(url.hostname) || !url.pathname.endsWith("/hustle_adaptive_ci"))
 throw Error("Refusing non-disposable database");
const db=new PrismaClient();
const api=new AdaptiveService(db);
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
 // Canonical Booking/Order remain unmodified and visible only to authenticated participants.
 const profile=await db.professionalProfile.create({data:{userId:owner.id}});
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
 process.stdout.write("Adaptive disposable Postgres: workspace, consent, revocation, CAS, legacy work isolation PASS\n");
}
run().catch(e=>{process.stderr.write(String(e.stack||e)+"\n");process.exitCode=1}).finally(()=>db.$disconnect());
