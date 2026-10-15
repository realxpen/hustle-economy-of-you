#!/usr/bin/env node
// Real scheduling-service logic with an isolated in-memory Prisma double.
// Never connects to Supabase, sends a Booking request or touches payment providers.
"use strict";
require("reflect-metadata");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const scheduleSource = fs.readFileSync("apps/api/src/booking/booking-schedule.service.ts","utf8");
const bookingSource = fs.readFileSync("apps/api/src/booking/booking.service.ts","utf8");
const schema = fs.readFileSync("apps/api/prisma/schema.prisma","utf8");
const migration = fs.readFileSync("apps/api/prisma/migrations/20261015122500_flowtime_adaptive_booking/migration.sql","utf8");
const editor = fs.readFileSync("apps/web/app/services/service-editor.tsx","utf8");
const form = fs.readFileSync("apps/web/app/bookings/new/[serviceId]/page.tsx","utf8");

assert.match(schema, /enum BookingOperationMode/);
assert.match(migration, /ALTER TABLE "Service"/);
assert.match(migration, /CREATE TABLE "BookingScheduleRevision"/);
assert.match(migration, /flowtime_positive_policy/);
assert.match(scheduleSource, /pg_advisory_xact_lock\(hashtext/);
assert.match(bookingSource, /reserveWithinTransaction\(tx/);
assert.match(bookingSource, /tx\.booking\.updateMany/);
assert.match(bookingSource, /booking\.schedule_extended/);
assert.match(bookingSource, /actualStartedAt: new Date\(\)/);
assert.match(bookingSource, /actualFinishedAt: new Date\(\)/);
assert.match(editor, /FlowTime · Scheduling & capacity/);
assert.match(editor, /weeklyHours/);
assert.match(form, /listFlowTimeSlots/);
assert.match(form, /Fully booked/);

const { BookingScheduleService } = require("../../apps/api/dist/booking/booking-schedule.service.js");
const { BookingOperationMode, BookingStatus } = require("@prisma/client");
const hour = 3600000;
const tomorrow = new Date(Date.now() + 7 * 24 * hour);
tomorrow.setUTCHours(9,0,0,0);
const later = (d, mins) => new Date(d.getTime() + mins*60000);
const owner = { userId:"hustler" };
const base = {
 id:"service1", professionalProfileId:"professional1",
 bookingMode:BookingOperationMode.APPOINTMENT, bookingTimezone:"Africa/Lagos",
 resourcePoolKey:"primary", defaultDurationMinutes:60,
 prepMinutes:0, bufferMinutes:0, parallelCapacity:1, overbookingAllowance:0,
 weeklyHours:null, blackoutDates:[],maxActiveJobs:5,turnaroundHours:72,
 autoExtensionMinutes:15,professionalProfile:owner
};
const booked = (id,start,end,policy=base,status=BookingStatus.ACCEPTED)=>({
 id,confirmedStartAt:start,confirmedEndAt:end, status,
 service:{bookingMode:policy.bookingMode,defaultDurationMinutes:policy.defaultDurationMinutes,
 prepMinutes:policy.prepMinutes,bufferMinutes:policy.bufferMinutes,
 parallelCapacity:policy.parallelCapacity}
});
let record={...base}, rows=[], locks=0;
const prisma = {
 service:{findUnique:async()=>record},
 user:{findUnique:async()=>({id:"client"})},
 booking:{findMany:async()=>rows,findFirst:async()=>null},
 $queryRaw:async()=>{locks+=1;return [{pg_advisory_xact_lock:null}];}
};
const scheduler=new BookingScheduleService(prisma);
const identity={subject:"client-auth"};
(async()=>{
 const first=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(first.available,true,"unoccupied solo appointment must be available");
 assert.equal(first.endAt.toISOString(),later(tomorrow,60).toISOString(),"default duration must supply end");
 rows=[booked("one",tomorrow,later(tomorrow,60))];
 const blocked=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(blocked.available,false,"solo barber cannot double-book");
 const backToBack=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:later(tomorrow,60).toISOString()});
 assert.equal(backToBack.available,true,"back-to-back exact boundaries should not overlap");
 record={...record,bufferMinutes:15};
 const buffer=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:later(tomorrow,60).toISOString()});
 assert.equal(buffer.available,false,"prep/recovery must reserve shared pool time");
 record={...record,bufferMinutes:0,parallelCapacity:2};
 rows=[booked("one",tomorrow,later(tomorrow,60),record)];
 const team=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(team.remainingCapacity,1,"second barber can take another client");
 rows.push(booked("two",tomorrow,later(tomorrow,60),record));
 const full=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(full.available,false,"third barber must not be silently accepted");
 record={...record,overbookingAllowance:1};
 const extra=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(extra.available,true,"explicit overbooking policy allows one extra");
 assert.equal(extra.overbooking,true,"extra places must be visibly flagged");
 record={...record,overbookingAllowance:0,parallelCapacity:1,
  bookingMode:BookingOperationMode.WORK_QUEUE,maxActiveJobs:2};
 rows=[booked("job1",tomorrow,later(tomorrow,60),record)];
 const queue=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(queue.available,true,"work queue accepts another overlapping order");
 rows.push(booked("job2",tomorrow,later(tomorrow,60),record));
 const fullQueue=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(fullQueue.available,false,"work queue enforces its maximum active work");
 record={...base,weeklyHours:[{day:tomorrow.getUTCDay(),start:"08:00",end:"09:00"}]};
 rows=[];
 const offHours=await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()});
 assert.equal(offHours.available,false,"operating hours checked in business time zone");
 record={...record,weeklyHours:null,blackoutDates:[new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).format(tomorrow)]};
 // The blackout check must use the business's actual calendar date.
 const ymd=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Lagos",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(tomorrow);
 const part=(k)=>ymd.find(p=>p.type===k).value;
 record.blackoutDates=[part("year")+"-"+part("month")+"-"+part("day")];
 assert.equal((await scheduler.checkAvailability(identity,{serviceId:record.id,startAt:tomorrow.toISOString()})).available,false);
 record={...base};
 await scheduler.reserveWithinTransaction(prisma,{serviceId:record.id,hustlerUserId:owner.userId,startAt:tomorrow,endAt:null});
 assert.ok(locks>0,"commit path must acquire transaction-scoped Hustler capacity lock");
 const slots=await scheduler.listSlots(identity,record.id,
  new Date(tomorrow.getTime()).toISOString().slice(0,10));
 assert.equal(slots.mode,BookingOperationMode.APPOINTMENT);
 assert.ok(Array.isArray(slots.slots));
 console.log("PASS: FlowTime duration, adjacent slots, buffers, parallel capacity, explicit overbooking, queue, closures and locking");
})().catch(e=>{console.error(e);process.exitCode=1;});
