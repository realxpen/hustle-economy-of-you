/** Pure roster rules. Weekday 0=Sunday. Never infer staff availability from a name alone. */
export type WeeklyShift={day:number;start:string;end:string};
export type StaffSlot={active:boolean;weeklyHours:unknown;leave?:{startAt:Date;endAt:Date;cancelledAt:Date|null}[]};
const clock=(s:unknown):s is string=>typeof s==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export function validateWeeklyShifts(input:unknown):WeeklyShift[]{
 if(!Array.isArray(input)||input.length>28)throw Error("Provide at most 28 weekly shifts");
 const shifts:WeeklyShift[]=input.map(x=>{
  if(!x||typeof x!=="object"||Array.isArray(x))throw Error("Invalid shift");
  const v=x as Record<string,unknown>;
  if(typeof v.day!=="number"||!Number.isInteger(v.day)||v.day<0||v.day>6||
     !clock(v.start)||!clock(v.end)||v.start>=v.end)throw Error("Shifts require weekday and increasing 24-hour times");
  return {day:v.day,start:v.start,end:v.end};
 });
 for(let i=0;i<shifts.length;i++)for(let j=i+1;j<shifts.length;j++){
  const a=shifts[i],b=shifts[j];
  if(a.day===b.day&&a.start<b.end&&b.start<a.end)throw Error("A worker's shifts cannot overlap");
 }
 return shifts;
}
function localParts(t:Date,tz:string){
 const p=new Intl.DateTimeFormat("en-GB",{timeZone:tz,weekday:"short",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(t);
 const field=(k:string)=>p.find(x=>x.type===k)?.value||"";
 return {day:["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(field("weekday")),
  date:field("year")+"-"+field("month")+"-"+field("day"),clock:field("hour")+":"+field("minute")};
}
export function staffCoversSlot(staff:StaffSlot,start:Date,end:Date,tz:string):boolean {
 if(!staff.active||end<=start)return false;
 const a=localParts(start,tz),b=localParts(end,tz);
 // Overnight shifts are deliberately unsupported until a separately tested model exists.
 if(a.date!==b.date)return false;
 const hours=Array.isArray(staff.weeklyHours)?staff.weeklyHours as WeeklyShift[]:[];
 if(!hours.some(w=>w.day===a.day&&w.start<=a.clock&&w.end>=b.clock))return false;
 return !(staff.leave||[]).some(l=>!l.cancelledAt&&l.startAt<end&&start<l.endAt);
}
export function rosterCapacity(staff:StaffSlot[],stations:number,start:Date,end:Date,tz:string){
 if(!Number.isSafeInteger(stations)||stations<1)return 0;
 return Math.min(stations,staff.filter(s=>staffCoversSlot(s,start,end,tz)).length);
}
