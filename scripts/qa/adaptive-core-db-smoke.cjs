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
 const template=await api.draftService(own,business.id,{title:"Custom festival outfit",blueprint:"item",priceMinor:1800000,policy:{measurement:"client supplied"}});
 assert.equal(template.priceMinor,1800000);
 const list=await api.services(own,business.id);
 assert.equal(list.length,1);
 assert.equal(list[0].blueprint.slug,"item");
 await expectForbidden(api.invite(own,business.id,{username:"adaptiveagent",role:"AGENT",permissions:["wallet.withdraw"]}),400);
 const invite=await api.invite(own,business.id,{username:"adaptiveagent",role:"AGENT",permissions:["work.manage"]});
 assert.equal(invite.status,"INVITED");
 await expectForbidden(api.services(member,business.id));
 await expectForbidden(api.respond(other,invite.id,true),409);
 await api.respond(member,invite.id,true);
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
