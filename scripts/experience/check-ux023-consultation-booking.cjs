#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const ts=require("typescript");
const compiled=ts.transpileModule(fs.readFileSync("apps/web/lib/booking-consultation-policy.ts","utf8"),
 {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}}; new Function("module","exports",compiled)(m,m.exports);
const allow=m.exports.shouldContinueBookingWithoutConversation;
for(const mode of ["APPOINTMENT","WORK_QUEUE",null,undefined]){
 for(const status of [502,503,504]) assert.equal(allow(mode,{status}),true);
 for(const err of [null,new Error("network"),{status:400},{status:401},{status:403},{status:404},{status:409},{status:429},{status:500},{status:200},{status:"503"}])
  assert.equal(allow(mode,err),false,"Unexpected messaging errors fail closed");
}
for(const status of [200,400,403,502,503,504])
 assert.equal(allow("CONSULTATION",{status}),false,"Never bypass consultation");
const form=fs.readFileSync("apps/web/app/bookings/new/[serviceId]/page.tsx","utf8");
const api=fs.readFileSync("apps/api/src/booking/booking.service.ts","utf8");
assert.match(form,/shouldContinueBookingWithoutConversation\(data\.service\.bookingMode, conversationError\)/);
assert.match(form,/Opening a chat without sending a Service-linked message is not enough/);
assert.match(form,/service\.bookingMode === "CONSULTATION"/);
assert.match(form,/\.\.\.\(conversationId \? \{ conversationId \} : \{\}\)/);
assert.match(form,/clearBookingDraft\(tabStorage\(\), data\.service\.id\)/);
assert.match(api,/contextType: MessageContextType\.SERVICE, contextId: service\.id/);
console.log("PASS UX023: isolated consultation-first and fail-closed messaging resilience.");
