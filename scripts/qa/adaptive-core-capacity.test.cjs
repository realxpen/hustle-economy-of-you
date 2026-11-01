"use strict";
require("reflect-metadata");
const test=require("node:test"),assert=require("node:assert/strict");
const {BookingScheduleService}=require("../../apps/api/dist/booking/booking-schedule.service");
const start=new Date("2030-11-04T09:00:00Z"),end=new Date("2030-11-04T10:00:00Z");
function setup({stations=2,rows=[],hours=null,buffer=0}={}){
 const service={id:"service",status:"PUBLISHED",bookingMode:"APPOINTMENT",bookingTimezone:"Africa/Lagos",
  professionalProfile:{userId:"owner"},resourcePoolKey:"pool",defaultDurationMinutes:60,
  prepMinutes:0,bufferMinutes:buffer,parallelCapacity:2,overbookingAllowance:0,
  weeklyHours:hours,blackoutDates:[],turnaroundHours:48};
 const staff={active:true,weeklyHours:Array.from({length:7},(_,day)=>({day,start:"09:00",end:"17:00"})),leave:[]};
 const db={service:{findUnique:async()=>service},
  booking:{findMany:async({where})=>rows.filter(x=>x.id!==where.id?.not)},
  adaptiveServiceDraft:{findUnique:async()=>({workspace:{rosterEnabled:true,stationCapacity:stations,staff:[staff,staff]}})}};
 const scheduler=new BookingScheduleService(db);
 const row=(id,a=start,b=end)=>({id,confirmedStartAt:a,confirmedEndAt:b,service});
 const review=()=>scheduler.reviewReservation(db,{id:"self",serviceId:"service",confirmedStartAt:start,confirmedEndAt:end});
 return {row,review,rows};
}
process.env.HUSTLE_ADAPTIVE_CORE_ENABLED="true";
test("a reservation does not compete with itself",async()=>{
 const f=setup({stations:1});f.rows.push(f.row("self"));assert.equal((await f.review()).available,true);
});
test("one broken chair flags overlapping commitments despite two eligible workers",async()=>{
 const f=setup({stations:1});f.rows.push(f.row("self"),f.row("other"));
 const result=await f.review();assert.equal(result.available,false);assert.equal(result.capacity,1);
});
test("full but not overcommitted reservations still fit",async()=>{
 const f=setup();f.rows.push(f.row("self"),f.row("other"));assert.equal((await f.review()).available,true);
});
test("adjacent reservations do not add to peak occupancy",async()=>{
 const f=setup();const midpoint=new Date("2030-11-04T09:30:00Z");
 f.rows.push(f.row("first",start,midpoint),f.row("second",midpoint,end));
 assert.equal((await f.review()).available,true);
});
test("cleanup buffers count towards conflicts",async()=>{
 const f=setup({stations:1,buffer:15});
 f.rows.push(f.row("previous",new Date("2030-11-04T08:00:00Z"),start));
 assert.equal((await f.review()).available,false);
});
test("changed business hours flag a previously confirmed reservation",async()=>{
 const f=setup({hours:[]});assert.match((await f.review()).reason,/opening hours/);
});
