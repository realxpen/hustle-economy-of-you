"use strict";
// Generated identities only, inside the fixed clone of the migrated restore.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const expected='postgresql://hustle_api@127.0.0.1:5432/hustle_payment_sandbox?schema=public&connection_limit=5';
assert.equal(process.env.DATABASE_URL,expected,'Only the isolated API-role clone is allowed');
require('reflect-metadata');
const {PrismaClient}=require('@prisma/client');
const {BookingService}=require('/app/apps/api/dist/booking/booking.service.js');
const {BookingScheduleService}=require('/app/apps/api/dist/booking/booking-schedule.service.js');
const {NotificationsService}=require('/app/apps/api/dist/notifications/notifications.service.js');
const db=new PrismaClient({log:[]});
const service=new BookingService(db,new NotificationsService(db),new BookingScheduleService(db));
const identity=subject=>({subject,emailVerified:false,phoneVerified:false});
const minute=60000;
let stage='ROLE';
async function rejected(fn,status){
  await assert.rejects(fn,e=>typeof e.getStatus==='function' && e.getStatus()===status);
}
async function main(){
 const [role]=await db.$queryRaw`SELECT current_user AS role, rolsuper, rolbypassrls FROM pg_roles WHERE rolname=current_user`;
 assert.equal(role.role,'hustle_api'); assert.equal(role.rolsuper,false); assert.equal(role.rolbypassrls,false);
 stage='FIXTURES';const tag='generated-acceptance-'+randomUUID();
 const seller=await db.user.create({data:{authSubject:tag+'seller',capabilities:{create:{capability:'HUSTLER',status:'ACTIVE'}}}});
 const buyer=await db.user.create({data:{authSubject:tag+'buyer'}});
 const other=await db.user.create({data:{authSubject:tag+'other'}});
 const sellerIdentity=identity(seller.authSubject),buyerIdentity=identity(buyer.authSubject),otherIdentity=identity(other.authSubject);
 const profile=await db.professionalProfile.create({data:{userId:seller.id,status:'PUBLISHED'}});
 const offer=await db.service.create({data:{professionalProfileId:profile.id,title:'Generated capacity test',status:'PUBLISHED',priceMinor:5000}});
 const start=new Date(Date.now()+7*86400000);start.setUTCHours(9,0,0,0);
 const request=at=>service.create(buyerIdentity,{serviceId:offer.id,requestedStartAt:at.toISOString(),requirements:'Generated local rehearsal only'});
 const first=await request(start),second=await request(start);
 stage='PARTICIPANT_GUARDS';await rejected(()=>service.get(otherIdentity,first.id),404);
 await rejected(()=>service.accept(buyerIdentity,first.id,{}),403);
 stage='LAST_SLOT_RACE';const race=await Promise.allSettled([service.accept(sellerIdentity,first.id,{}),service.accept(sellerIdentity,second.id,{})]);
 assert.equal(race.filter(x=>x.status==='fulfilled').length,1,'Exactly one last-slot acceptance');
 const loser=race.find(x=>x.status==='rejected');assert.equal(loser.reason.getStatus(),409);
 const accepted=await db.booking.findMany({where:{id:{in:[first.id,second.id]},status:'PAYMENT_PENDING'}});
 assert.equal(accepted.length,1);const winner=accepted[0];
 const loserId=winner.id===first.id?second.id:first.id;
 stage='OCCUPIED_SLOT';await rejected(()=>service.accept(sellerIdentity,loserId,{}),409);
 assert.equal((await db.booking.findUniqueOrThrow({where:{id:loserId}})).status,'REQUESTED');
 stage='FUNDING_GUARD';await rejected(()=>service.start(sellerIdentity,winner.id),409);
 assert.equal(await db.paymentAttempt.count({where:{subjectType:'BOOKING',subjectId:winner.id}}),0);
 assert.equal(await db.notification.count({where:{eventKey:`booking:${winner.id}:PAYMENT_PENDING`}}),1);
 // Free work exercises start/extension without inventing a paid funding event.
 stage='FREE_START';await db.service.update({where:{id:offer.id},data:{priceMinor:0}});
 const freeStart=new Date(start.getTime()+3*3600000);
 const free=await request(freeStart);await service.accept(sellerIdentity,free.id,{});
 await service.start(sellerIdentity,free.id);
 await rejected(()=>service.extend(buyerIdentity,free.id,{minutes:15}),403);
 stage='EXTENSION_RACE';const extensions=await Promise.allSettled([service.extend(sellerIdentity,free.id,{minutes:15}),service.extend(sellerIdentity,free.id,{minutes:15})]);
 const successes=extensions.filter(x=>x.status==='fulfilled').length;assert.ok(successes>=1);
 for(const r of extensions.filter(x=>x.status==='rejected'))assert.equal(r.reason.getStatus(),409);
 const extended=await db.booking.findUniqueOrThrow({where:{id:free.id}});
 assert.equal(extended.extendedMinutes,15*successes);
 assert.equal(extended.agreedPriceMinor,0);assert.ok(extended.actualStartedAt);
 assert.equal(await db.bookingScheduleRevision.count({where:{bookingId:free.id}}),successes);
 assert.equal(await db.notification.count({where:{eventKey:{startsWith:`booking:${free.id}:extension:`}}}),successes);
 // An overlapping following job must prevent another extension.
 stage='EXTENSION_CONFLICT';const nextStart=new Date(extended.confirmedEndAt.getTime()+5*minute);
 const next=await request(nextStart);await service.accept(sellerIdentity,next.id,{});
 await rejected(()=>service.extend(sellerIdentity,free.id,{minutes:15}),409);
 const unchanged=await db.booking.findUniqueOrThrow({where:{id:free.id}});
 assert.equal(unchanged.extendedMinutes,extended.extendedMinutes);
 assert.equal(await db.bookingScheduleRevision.count({where:{bookingId:free.id}}),successes);
 stage='COMPLETE';await service.complete(sellerIdentity,free.id);
 assert.ok((await db.booking.findUniqueOrThrow({where:{id:free.id}})).actualFinishedAt);
 process.stdout.write(JSON.stringify({last_slot_race_passed:true,extension_race_and_conflict_passed:true,participant_guards_passed:true,unfunded_start_denied:true,non_bypass_api_role:true}));
}
main().catch(e=>{process.stderr.write('APPLICATION_ACCEPTANCE_FAILED:'+stage+':'+ (typeof e.code==='string'&&/^P\d{4}$/.test(e.code)?e.code:'ASSERTION'));if(process.env.HUSTLE_GENERATED_ASSERTIONS==='1')console.error(e);process.exitCode=1;}).finally(()=>db.$disconnect());
