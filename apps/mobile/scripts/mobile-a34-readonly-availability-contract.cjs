#!/usr/bin/env node
/**
 * Connected A3.4: appointment availability is GET-only and never reserves,
 * transacts or writes. Executes the actual pure TypeScript helpers with
 * synthetic server-shaped slots; source guards cover UI integration.
 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"..");
const repo=path.resolve(root,"../..");
const read=p=>fs.readFileSync(path.join(repo,p),"utf8");
const helperFile=path.join(root,"src/ux004/discovery/connectedOpportunityAvailability.ts");
const helperSource=fs.readFileSync(helperFile,"utf8");
const api=read("apps/mobile/src/experience/feed-api.ts");
const screen=read("apps/mobile/src/experience/MobileExperience.tsx");
const backend=read("apps/api/src/booking/booking.controller.ts");
const schedule=read("apps/api/src/booking/booking-schedule.service.ts");
const doc=read("apps/mobile/docs/MOBILE_A34_READONLY_AVAILABILITY.md");
for(const m of helperSource.matchAll(/import type\s+\{[^}]+\}\s+from\s+["']([^"']+)["']/g))
 assert.ok(fs.existsSync(path.resolve(path.dirname(helperFile),m[1]+".ts")),"Unresolved type import "+m[1]);
const compiled=ts.transpileModule(helperSource,{compilerOptions:{
  target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true
},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const mod=new Module(helperFile,module);
mod.filename=helperFile;mod.paths=Module._nodeModulePaths(path.dirname(helperFile));
mod._compile(compiled.outputText,helperFile);
const {enquiryServiceId,currentEnquirySlots,enquirySlotLabel,enquiryNextDays}=mod.exports;
function check(label,fn){fn();console.log("PASS: "+label);}
const service={kind:"service",id:"svc-101",service:{id:"svc-101",title:"Custom fitting",bookingMode:"APPOINTMENT"},owner:{id:"user-101"}};
const now=Date.parse("2026-11-10T00:00:00.000Z");
const valid={startAt:"2026-11-10T09:00:00.000Z",endAt:"2026-11-10T09:30:00.000Z",available:true,remainingCapacity:1};
const second={startAt:"2026-11-10T12:00:00.000Z",endAt:null,available:true,remainingCapacity:2};

check("Slot lookup accepts only the canonical searched published service ID",()=>{
  assert.equal(enquiryServiceId(service),"svc-101");
  assert.equal(enquiryServiceId({...service,id:"wrong"}),null);
  assert.equal(enquiryServiceId({...service,service:{title:"Unknown"}}),null);
  assert.equal(enquiryServiceId({...service,service:{id:"../admin",title:"Bad"}}),null);
  assert.equal(enquiryServiceId({kind:"product",id:"svc-101",product:{id:"svc-101"}}),null);
  assert.equal(enquiryServiceId({kind:"post",id:"post-1"}),null);
  assert.equal(enquiryServiceId(null),null);
});
check("Only fresh unreserved, positive-capacity APPOINTMENT slots remain",()=>{
  const page={mode:"APPOINTMENT",date:"2026-11-10",timezone:"Africa/Lagos",slots:[
    valid,second,valid,
    {startAt:"2026-11-09T09:00:00.000Z",available:true,remainingCapacity:3},
    {startAt:"2026-11-10T10:00:00.000Z",available:false,remainingCapacity:10},
    {startAt:"2026-11-10T11:00:00.000Z",available:true,remainingCapacity:0},
    {startAt:"malformed",available:true,remainingCapacity:2}
  ]};
  const before=JSON.stringify(page);
  assert.deepEqual(currentEnquirySlots(page,now),[valid,second]);
  assert.deepEqual(currentEnquirySlots({...page,mode:"WORK_QUEUE"},now),[]);
  assert.deepEqual(currentEnquirySlots({...page,mode:"CONSULTATION"},now),[]);
  assert.deepEqual(currentEnquirySlots(null,now),[]);
  assert.deepEqual(currentEnquirySlots({...page,slots:[]},now),[]);
  assert.equal(JSON.stringify(page),before,"do not rewrite backend data");
});
check("Timezone-aware slot label and future day choices never invent local clock times",()=>{
  const text=enquirySlotLabel("2026-11-10T09:00:00Z","Africa/Lagos");
  assert.ok(text&&/10/.test(text),text);
  assert.equal(enquirySlotLabel("2026-11-10T09:00:00Z","Invalid/Timezone"),null);
  assert.equal(enquirySlotLabel("not-a-date","Africa/Lagos"),null);
  assert.deepEqual(enquiryNextDays(Date.parse("2026-10-22T23:59:00.000Z"),3),
    ["2026-10-23","2026-10-24","2026-10-25"]);
});
check("Existing authenticated backend provides only a GET slot read and truthful booking modes",()=>{
  assert.match(backend,/@Controller\("bookings"\)/);
  assert.match(backend,/@UseGuards\(AuthGuard\)/);
  assert.match(backend,/@Get\("slots"\)/);
  assert.match(backend,/bookingScheduleService\.listSlots\(identity, serviceId, date\)/);
  assert.match(schedule,/async listSlots\(identity: AuthIdentity, serviceId: string, date: string\)/);
  assert.match(schedule,/if \(service\.status !== ServiceStatus\.PUBLISHED\)/);
  assert.match(schedule,/if \(service\.bookingMode !== BookingOperationMode\.APPOINTMENT\)/);
  assert.match(schedule,/timezone: service\.bookingTimezone/);
  assert.match(schedule,/slots\.push\(\{ startAt: start\.toISOString\(\)/);
  assert.match(api,/slots: \(token: string, serviceId: string, date: string\) =>\s*api<SlotPage>\(token, '\/bookings\/slots\?/);
});
check("Enquiry schedule reads are explicit, invalidate races and show no false reservation",()=>{
  assert.match(screen,/const \[enquirySlotPage, setEnquirySlotPage\] = useState<SlotPage \| null>\(null\)/);
  assert.match(screen,/const \[enquirySelectedSlot, setEnquirySelectedSlot\] = useState<BookingSlot \| null>\(null\)/);
  assert.match(screen,/const enquirySlotsSeq = useRef\(0\)/);
  assert.match(screen,/function clearEnquirySlots\(\) \{\s*enquirySlotsSeq\.current \+= 1/);
  assert.match(screen,/function chooseEnquiryDate\(date: string\)/);
  assert.match(screen,/async function checkEnquiryAvailability\(\)/);
  assert.match(screen,/const serviceId = enquiryServiceId\(opportunitySelectedOffer\)/);
  assert.match(screen,/const seq = \+\+enquirySlotsSeq\.current/);
  assert.match(screen,/await mobileApi\.slots\(token, serviceId, date\)/);
  assert.match(screen,/if \(seq !== enquirySlotsSeq\.current\) return/);
  assert.match(screen,/if \(page\.date !== date\) throw new Error/);
  assert.match(screen,/if \(seq === enquirySlotsSeq\.current\) setEnquirySlotError/);
  assert.match(screen,/setEnquirySlotPage\(page\)/);
  assert.match(screen,/enquiryNextDays\(\)\.map\(date =>/);
  assert.match(screen,/onPress=\{\(\) => void checkEnquiryAvailability\(\)\}/);
  assert.match(screen,/const enquiryAvailableSlots = currentEnquirySlots\(enquirySlotPage\)/);
  assert.match(screen,/Displayed times can change and are not reserved/);
  assert.match(screen,/No available appointment starts were returned for this day/);
  assert.match(screen,/This service uses a work queue, not appointment slots/);
  assert.match(screen,/This service uses consultation scheduling, not public appointment slots/);
});
check("Unsent enquiry includes optional preferred time, not a booking request",()=>{
  assert.match(screen,/setEnquirySelectedSlot\(slot\); setEnquiryReviewed\(false\)/);
  assert.match(screen,/const enquirySlotTime = enquirySelectedSlot && enquirySlotPage/);
  assert.match(screen,/Preferred appointment: ' \+ enquiryDate/);
  assert.match(screen,/No confirmed appointment time selected/);
  assert.match(screen,/Enquiry prepared — not sent/);
  assert.match(screen,/No provider has received this enquiry/);
  assert.match(screen,/Back to service<\/Action>/);
  assert.match(screen,/clearEnquirySlots\(\); setOpportunityStage\('offer'\)/);
  assert.match(screen,/if \(process\.env\.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== 'true'\)/);
  const slice=screen.slice(screen.indexOf("  // A read-only GET may return"),screen.indexOf("  const offerService =",screen.indexOf("  // A read-only GET may return")));
  assert.doesNotMatch(slice,/mobileApi\.(requestBooking|save|like|comment|follow|event)\(/);
  assert.doesNotMatch(helperSource,/\bfetch\s*\(|requestBooking|initializePayment|escrow\.release/);
});
check("Earlier A3.1–A3.3 contracts stay wired and device acceptance stays pending",()=>{
  const entry=read("apps/mobile/scripts/mobile-experience-contract.mjs");
  assert.ok(entry.includes("mobile-a32-search-tabs-contract.cjs"));
  assert.ok(entry.includes("mobile-a33-connected-opportunity-contract.cjs"));
  assert.ok(entry.includes("mobile-a34-readonly-availability-contract.cjs"));
  assert.match(doc,/Runtime acceptance: PENDING/);
  assert.match(doc,/No Expo APK/);
});
console.log("Mobile A3.4 actual schedule selector and source guards PASS; signed-in device QA PENDING.");
