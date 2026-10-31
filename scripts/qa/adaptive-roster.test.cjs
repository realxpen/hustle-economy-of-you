"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {validateWeeklyShifts,staffCoversSlot,rosterCapacity}=
 require("../../apps/api/dist/adaptive/adaptive-roster-rules");
const zone="Africa/Lagos";
const monday=new Date("2026-11-02T09:00:00Z"),end=new Date("2026-11-02T09:30:00Z"); // Lagos 10 AM
const shift=[{day:1,start:"09:00",end:"17:00"}];
const person=(override={})=>({active:true,weeklyHours:shift,leave:[],...override});
test("valid weekday shifts and nonoverlap",()=>assert.deepEqual(validateWeeklyShifts(shift),shift));
test("reject invalid or overlapping weekly windows",()=>{
 assert.throws(()=>validateWeeklyShifts([{day:1,start:"15:00",end:"10:00"}]),/weekday/);
 assert.throws(()=>validateWeeklyShifts([...shift,{day:1,start:"11:00",end:"15:00"}]),/overlap/);
 assert.throws(()=>validateWeeklyShifts([{day:8,start:"09:00",end:"12:00"}]),/weekday/);
});
test("staff must cover the whole interval, including buffers",()=>{
 assert.equal(staffCoversSlot(person(),monday,end,zone),true);
 assert.equal(staffCoversSlot(person({weeklyHours:[{day:1,start:"10:15",end:"17:00"}]}),monday,end,zone),false);
});
test("inactive worker or empty shifts never count",()=>{
 assert.equal(rosterCapacity([person({active:false}),person({weeklyHours:[]})],4,monday,end,zone),0);
});
test("actual stations cap available people",()=>{
 assert.equal(rosterCapacity([person(),person(),person()],2,monday,end,zone),2);
 assert.equal(rosterCapacity([person(),person()],4,monday,end,zone),2);
});
test("active time off blocks exactly overlapping time, cancellation restores it",()=>{
 const leave={startAt:new Date("2026-11-02T08:00:00Z"),endAt:new Date("2026-11-02T11:00:00Z"),cancelledAt:null};
 assert.equal(staffCoversSlot(person({leave:[leave]}),monday,end,zone),false);
 assert.equal(staffCoversSlot(person({leave:[{...leave,cancelledAt:new Date()}]}),monday,end,zone),true);
});
test("weekend and cross-midnight intervals are closed when no covering shift",()=>{
 assert.equal(staffCoversSlot(person(),new Date("2026-11-01T09:00:00Z"),new Date("2026-11-01T09:30:00Z"),zone),false);
 assert.equal(staffCoversSlot(person(),new Date("2026-11-02T22:30:00Z"),new Date("2026-11-03T00:00:00Z"),zone),false);
});
test("malformed station counts fail closed",()=>{
 assert.equal(rosterCapacity([person()],0,monday,end,zone),0);
 assert.equal(rosterCapacity([person()],1.5,monday,end,zone),0);
});
