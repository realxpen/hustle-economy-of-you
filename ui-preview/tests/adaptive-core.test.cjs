/* Hustle Adaptive domain contract tests; run: node ui-preview/tests/adaptive-core.test.cjs */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../dist/hustle-adaptive.js"),"utf8");
const window={};
new Function("window",source)(window);
const a=window.HustleAdaptive;
const tests=[];
function test(name,fn){tests.push({name,fn})}
test("9 service blueprints cover different economic patterns",()=>assert.equal(a.blueprints.length,9));
test("one account starts with personal and separate business workspaces",()=>{
 const s=a.getState();assert.equal(s.currentSpace,"personal");assert.ok(s.spaces.filter(x=>x.type==="business").length>=2);
});
test("capability toggles do not grant identity verification",()=>{
 a.addCapability("teach");assert.ok(a.getState().person.capabilities.includes("teach"));assert.equal(a.getState().person.verified,false);
});
test("create a distinct business and switch contexts",()=>{
 const s=a.createSpace("Test Vendor Studio","business","Design");assert.ok(s);assert.ok(a.switchSpace(s.id));assert.equal(a.currentSpace().id,s.id);
});
test("duplicate workspace rejected",()=>assert.equal(a.createSpace("Test Vendor Studio","business","Design"),null));
test("unrecognized user cannot access business permissions",()=>assert.equal(a.can("work.manage",a.currentSpace().id,"anonymous"),false));
test("draft custom service from blueprint",()=>{
 const s=a.makeService("Premium video commission","digital",12000);assert.equal(s.blueprint,"digital");assert.equal(s.price,12000);
});
let workId;
test("service request creates a versioned work record",()=>{
 const s=a.getState().services.find(x=>x.title==="Premium video commission");
 const w=a.newWork("Edit my graduation film","digital","Two-minute video edit",a.currentSpace().id,"client need",s.id);
 assert.ok(w);workId=w.id;assert.equal(w.version,1);
});
test("invalid work transition blocked",()=>assert.equal(a.advanceWork(workId,"completed",1),false));
test("accepted request advances work and revision",()=>{
 assert.ok(a.advanceWork(workId,"accepted",1));assert.equal(a.getState().orders.find(x=>x.id===workId).version,2);
});
test("stale revision cannot overwrite new work",()=>assert.equal(a.advanceWork(workId,"in_progress",1),false));
test("no completion evidence on unfinished work",()=>assert.equal(a.attachEvidence(workId,"Sample proof"),null));
let grantId;
test("financially privileged delegation rejected",()=>assert.equal(a.requestDelegation(a.currentSpace().id,"Unsafe agent",["wallet.withdraw"]),null));
test("agent invitation remains pending without consent",()=>{
 const g=a.requestDelegation(a.currentSpace().id,"Scoped assistant",["work.manage","messages.reply"]);assert.ok(g);grantId=g.id;assert.equal(g.state,"pending_consent");
});
test("pending agent cannot be assigned",()=>assert.equal(a.assignWork(workId,grantId),false));
test("demo consent enables scoped work assignment",()=>{assert.ok(a.consentDelegation(grantId));assert.ok(a.assignWork(workId,grantId));});
test("revoked agent cannot be assigned new work",()=>{assert.ok(a.revokeDelegation(grantId));assert.equal(a.assignWork(workId,grantId),false);});
test("work can follow legal path to completed",()=>{
 assert.ok(a.advanceWork(workId,"in_progress",3)); // assignment increments version
 assert.ok(a.advanceWork(workId,"ready",4));
 assert.ok(a.advanceWork(workId,"delivered",5));
 assert.ok(a.advanceWork(workId,"review",6));
 assert.ok(a.advanceWork(workId,"completed",7));
});
test("completed work can have clearly labeled evidence claim",()=>{
 const e=a.attachEvidence(workId,"Delivery proof example","Private sample");assert.ok(e);assert.equal(e.level,"completion_claim");
});
test("event client request infers multiple services",()=>{
 const o=a.createOpportunity("Wedding with family photos","Need food, wedding photography and outfit styling","event","Lagos",250000);
 assert.ok(o.services.includes("Photography"));assert.ok(o.services.includes("Tailoring"));assert.ok(o.services.includes("Food preparation"));
 const candidates=a.suggestOpportunity(o.id);assert.ok(candidates.some(x=>x.provider==="Sample Lens Studio"));
 assert.ok(candidates.every(x=>x.sample)); // no false real availability
});
test("import existing booking is idempotent",()=>{
 const snap={reference:"HAB-unique-01",service:"Wash and iron",professional:"Sample Laundry",stage:"awaiting",price:4500,day:"2026-11-02",jobFulfillment:true};
 const w1=a.mirrorBooking(snap),w2=a.mirrorBooking(snap);
 assert.equal(w1.id,w2.id);assert.equal(a.getState().orders.filter(x=>x.externalRef==="HAB-unique-01").length,1);
});
test("connected booking is read only from duplicate hub",()=>{
 const r=a.getState().orders.find(x=>x.externalRef==="HAB-unique-01");
 assert.equal(a.advanceWork(r.id,"accepted",r.version),false);
});
test("booking mirror tracks actual authoritative state changes",()=>{
 const w=a.mirrorBooking({reference:"HAB-unique-01",service:"Wash and iron",professional:"Sample Laundry",stage:"work",jobStatus:"ready",paymentConfirmed:true,price:4500,jobFulfillment:true});
 assert.equal(w.state,"ready");assert.equal(w.paymentStatus,"simulated_paid");
});
test("work/evidence records remain scoped to workspace",()=>{
 const s=a.getState();assert.ok(s.orders.some(x=>x.spaceId===a.currentSpace().id));assert.ok(s.orders.some(x=>x.spaceId==="personal"));
});
let failed=0;
for(const {name,fn} of tests){
 try{fn();process.stdout.write("✓ "+name+"\n")}
 catch(error){failed++;process.stderr.write("✗ "+name+": "+error.message+"\n")}
}
process.stdout.write("\n"+(tests.length-failed)+"/"+tests.length+" checks passed\n");
if(failed)process.exitCode=1;
