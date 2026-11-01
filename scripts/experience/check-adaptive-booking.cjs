#!/usr/bin/env node
"use strict";
// Requires built apps/api/dist and generated Prisma client. No network or DB.
require("reflect-metadata");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {BookingOperationMode,BookingStatus}=require("@prisma/client");
const {BookingScheduleService}=require("../../apps/api/dist/booking/booking-schedule.service.js");
const schema=fs.readFileSync("apps/api/prisma/schema.prisma","utf8");
const backend=fs.readFileSync("apps/api/src/booking/booking.service.ts","utf8");
const migration=fs.readFileSync("apps/api/prisma/migrations/20261031103000_adaptive_service_booking/migration.sql","utf8");
assert.match(schema,/consultationPolicy\s+String/);
assert.match(schema,/partySize\s+Int/);
assert.match(migration,/booking_party_size_valid/);
assert.match(backend,/consultationRequested/);
assert.match(backend,/Paid consultation approval requires a separate verified consultation-payment flow/);
assert.match(backend,/agreedPriceMinor = service.priceMinor \* partySize/);
const hour=60*60*1000;
const start=new Date(Date.now()+7*24*hour);
start.setUTCHours(10,0,0,0);
const after=(at,hours)=>new Date(at.getTime()+hours*hour);
const service={
 id:"barber-service",status:"PUBLISHED",bookingMode:BookingOperationMode.APPOINTMENT,
 bookingTimezone:"Africa/Lagos",resourcePoolKey:"haircut-chairs",professionalProfileId:"profile-1",
 defaultDurationMinutes:60,prepMinutes:0,bufferMinutes:0,parallelCapacity:4,
 groupBookingsEnabled:true,overbookingAllowance:0,weeklyHours:null,blackoutDates:[],
 maxActiveJobs:10,turnaroundHours:48,autoExtensionMinutes:0,
 professionalProfile:{userId:"barber-account"}
};
const existing=(id,at,end,partySize=1)=>({
 id,status:BookingStatus.ACCEPTED,partySize,confirmedStartAt:at,confirmedEndAt:end,
 service:{bookingMode:BookingOperationMode.APPOINTMENT,defaultDurationMinutes:60,
  prepMinutes:0,bufferMinutes:0,parallelCapacity:4,maxActiveJobs:10}
});
let rows=[];
const prisma={
 service:{findUnique:async()=>service},
 booking:{findMany:async()=>rows,findFirst:async()=>null},
 user:{findUnique:async()=>({id:"client"})},
 $queryRaw:async()=>[{acquired:true}]
};
(async()=>{
 const scheduler=new BookingScheduleService(prisma);
 const check=(partySize,date=start)=>scheduler.checkAvailability(null,{serviceId:service.id,startAt:date.toISOString(),partySize});
 const single=await check(1);
 assert.equal(single.available,true);
 assert.equal(single.remainingCapacity,4);
 const group=await check(6);
 assert.equal(group.available,true);
 assert.equal(group.endAt.getTime()-start.getTime(),2*hour,
   "six clients with four barbers require at least two service hours");
 rows=[existing("a",start,after(start,1)),existing("b",start,after(start,1)),
       existing("c",start,after(start,1)),existing("d",start,after(start,1))];
 const fifth=await check(1);
 assert.equal(fifth.available,false,"four concurrent barber appointments consume four chairs");
 rows=[existing("g",start,after(start,2),4)];
 const overlap=await check(1,after(start,1));
 assert.equal(overlap.available,false,"conservative team hold prevents second-hour conflict");
 rows=[];
 const locked=await scheduler.reserveWithinTransaction(prisma,{
  serviceId:service.id,hustlerUserId:"barber-account",startAt:start,endAt:null,partySize:6});
 assert.equal(locked.available,true);
 assert.equal(locked.endAt.getTime()-start.getTime(),2*hour);
 service.groupBookingsEnabled=false;
 await assert.rejects(()=>check(2),/Group bookings are not enabled/);
 console.log("Adaptive booking: staffing, group duration, consultation boundaries and migration contract passed");
})().catch(e=>{console.error(e);process.exitCode=1});
