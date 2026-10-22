#!/usr/bin/env node
/**
 * HUSTLE: free, ephemeral connected API acceptance against the ACTUAL Nest
 * controllers, Prisma migrations and throwaway local PostgreSQL 16 database.
 *
 * The only test-specific authentication substitution lives IN THIS RUNNER,
 * never in product source. This is NOT a test of Supabase auth or device UI.
 */
"use strict";
require("reflect-metadata");
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const requireFromRoot = createRequire(require("node:path").resolve(process.cwd(), "package.json"));

function requireDisposableEnvironment() {
  assert.equal(process.env.NODE_ENV, "test", "Refuse non-test runtime");
  const url = new URL(process.env.DATABASE_URL || "invalid:");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.port, "55439");
  assert.equal(url.username, "postgres");
  assert.equal(url.pathname, "/hustle_payment_sandbox");
  for (const key of [
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "MONIFLOW_PARTNER_HMAC_SECRET", "VERCEL_TOKEN", "EXPO_TOKEN"
  ]) assert.ok(!process.env[key], "Do not run with external secrets: "+key);
  return url;
}
requireDisposableEnvironment();

const { Module, UnauthorizedException } = requireFromRoot("@nestjs/common");
const { NestFactory } = requireFromRoot("@nestjs/core");
const {
  SupabaseAuthService
} = requireFromRoot("./apps/api/dist/auth/supabase-auth.service.js");
const { DatabaseModule } = requireFromRoot("./apps/api/dist/database/database.module.js");
const { PrismaService } = requireFromRoot("./apps/api/dist/database/prisma.service.js");
const { SearchModule } = requireFromRoot("./apps/api/dist/search/search.module.js");
const { BookingModule } = requireFromRoot("./apps/api/dist/booking/booking.module.js");

// Hard safety boundary: only a local, short-lived HTTP server may use this
// fake identity. No key/credential or bypass is installed in the real API.
const clientToken = "local-client-" + randomUUID();
const hustlerToken = "local-hustler-" + randomUUID();
const subjectClient = "acceptance-client-" + randomUUID();
const subjectHustler = "acceptance-hustler-" + randomUUID();
const identities = new Map([
  [clientToken, {subject:subjectClient,emailVerified:false,phoneVerified:false}],
  [hustlerToken, {subject:subjectHustler,emailVerified:false,phoneVerified:false}]
]);
SupabaseAuthService.prototype.verifyAccessToken = async function(token) {
  const identity=identities.get(token);
  if (!identity) throw new UnauthorizedException("Invalid disposable test token");
  return identity;
};

class FreeLocalConnectedAcceptanceModule {}
Module({imports:[DatabaseModule,SearchModule,BookingModule]})(FreeLocalConnectedAcceptanceModule);

const nativeFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=(input,options={})=>{
  const url=new URL(typeof input==="string"?input:input.url);
  if (url.protocol!=="http:" || url.hostname!=="127.0.0.1" ||
      options.method && options.method.toUpperCase()!=="GET") {
    throw new Error("REFUSED external or write request during isolated acceptance");
  }
  return nativeFetch(input,options);
};

async function run() {
  const app=await NestFactory.create(FreeLocalConnectedAcceptanceModule,{
    logger:["error"]
  });
  app.setGlobalPrefix("api/v1");
  await app.listen(0,"127.0.0.1");
  const address=app.getHttpServer().address();
  const origin="http://127.0.0.1:"+address.port;
  const prisma=app.get(PrismaService);
  try {
    const db=await prisma.$queryRawUnsafe("SELECT current_database() AS name");
    assert.equal(db[0].name,"hustle_payment_sandbox");
    assert.equal(await prisma.booking.count(),0);
    const client=await prisma.user.create({
      data:{authSubject:subjectClient,displayName:"Temporary Test Client"}
    });
    const hustler=await prisma.user.create({data:{
      authSubject:subjectHustler,displayName:"Temporary Tailor",
      username:"ci-acceptance-"+randomUUID().slice(0,8),location:"Lagos",
      capabilities:{create:[{capability:"HUSTLER",status:"ACTIVE"}]}
    }});
    const profile=await prisma.professionalProfile.create({data:{
      userId:hustler.id,status:"PUBLISHED",primarySkill:"Tailoring",
      headline:"Temporary tailoring preview",category:"Fashion",
      publishedAt:new Date()
    }});
    const service=await prisma.service.create({data:{
      professionalProfileId:profile.id,title:"Tailor a test outfit",
      description:"Non-production tailoring service",status:"PUBLISHED",
      category:"Fashion",priceMinor:100000,currency:"NGN",
      bookingMode:"APPOINTMENT",bookingTimezone:"Africa/Lagos",
      publishedAt:new Date()
    }});
    const queuedService=await prisma.service.create({data:{
      professionalProfileId:profile.id,title:"Tailoring work queue",
      status:"PUBLISHED",priceMinor:50000,bookingMode:"WORK_QUEUE",
      publishedAt:new Date()
    }});
    const product=await prisma.product.create({data:{
      professionalProfileId:profile.id,title:"Tailoring fabric sample",
      status:"PUBLISHED",type:"PHYSICAL",priceMinor:50000,
      category:"Fashion",publishedAt:new Date()
    }});
    const post=await prisma.post.create({data:{
      professionalProfileId:profile.id,caption:"Tailoring proof of work",
      category:"Fashion",status:"PUBLISHED",publishedAt:new Date()
    }});

    async function get(path,token=clientToken) {
      const res=await globalThis.fetch(origin+"/api/v1"+path,{
        method:"GET",headers:token===null?{}:{"Authorization":"Bearer "+token}
      });
      const body=await res.json().catch(()=>null);
      return {status:res.status,body};
    }
    assert.equal((await get("/search?q=tailoring",null)).status,401);
    assert.equal((await get("/search?q=tailoring","wrong")).status,401);
    console.log("PASS: Real authenticated controllers reject missing/unknown Bearer tokens");

    const kinds=[["people","person",hustler.id],["posts","post",post.id],
      ["services","service",service.id],["products","product",product.id]];
    for(const [tab,kind,id] of kinds) {
      const res=await get("/search/"+tab+"?q=tailoring&limit=16");
      assert.equal(res.status,200,"Search tab "+tab+" HTTP status");
      assert.equal(res.body.tab,tab);
      const entry=res.body.items.find(x=>x.kind===kind && x.id===id);
      assert.ok(entry,"Backend search did not return canonical "+kind);
      if(kind==="service"||kind==="product") {
        assert.equal(entry.owner.id,hustler.id);
        assert.equal(entry.url,"/"+tab+"/"+id);
      }
    }
    const top=await get("/search?q=tailoring&limit=1");
    assert.equal(top.status,200);
    assert.equal(top.body.tab,"top");
    assert.equal(top.body.items.length,1);
    assert.equal(top.body.hasMore,true);
    assert.ok(top.body.nextCursor);
    const second=await get("/search?q=tailoring&limit=1&cursor="+
      encodeURIComponent(top.body.nextCursor));
    assert.equal(second.status,200);
    assert.equal(second.body.items.length,1);
    assert.notEqual(top.body.items[0].kind+top.body.items[0].id,
      second.body.items[0].kind+second.body.items[0].id);
    console.log("PASS: Published-only Top/People/Posts/Services/Products plus canonical owner/offer and real cursor");

    // Tomorrow in UTC, entirely inside the controller's <=90-day range.
    const future=new Date(Date.now()+86_400_000).toISOString().slice(0,10);
    const slots=await get("/bookings/slots?serviceId="+encodeURIComponent(service.id)+
      "&date="+future);
    assert.equal(slots.status,200);
    assert.equal(slots.body.mode,"APPOINTMENT");
    assert.equal(slots.body.date,future);
    assert.equal(slots.body.timezone,"Africa/Lagos");
    assert.ok(Array.isArray(slots.body.slots));
    assert.ok(slots.body.slots.length>0,"Tomorrow should include real derived appointment starts");
    assert.ok(slots.body.slots.every(s=>typeof s.startAt==="string" &&
      typeof s.available==="boolean" && Number.isInteger(s.remainingCapacity)));
    const queue=await get("/bookings/slots?serviceId="+
      encodeURIComponent(queuedService.id)+"&date="+future);
    assert.equal(queue.status,200);
    assert.equal(queue.body.mode,"WORK_QUEUE");
    assert.deepEqual(queue.body.slots,[]);
    assert.equal((await get("/bookings/slots?serviceId=missing&date="+future)).status,400);
    console.log("PASS: Real authenticated GET appointment timezone/capacity and non-appointment mode");

    // Execute the REAL Expo app's connected TypeScript API adapter and
    // opportunity/availability projection against this loopback Nest server.
    // This catches drift hidden by source-string or synthetic-response tests.
    process.env.EXPO_PUBLIC_API_URL=origin+"/api/v1";
    const fs=require("node:fs");
    const ModuleRuntime=require("node:module");
    const typescript=requireFromRoot("typescript");
    const oldTsHandler=ModuleRuntime._extensions[".ts"];
    ModuleRuntime._extensions[".ts"]=(mod,filename)=>{
      const source=fs.readFileSync(filename,"utf8");
      const compiled=typescript.transpileModule(source,{
        compilerOptions:{
          target:typescript.ScriptTarget.ES2020,
          module:typescript.ModuleKind.CommonJS,
          strict:true
        },
        reportDiagnostics:true
      });
      assert.equal((compiled.diagnostics||[]).filter(d=>
        d.category===typescript.DiagnosticCategory.Error).length,0,
        "Mobile helper transpilation: "+filename);
      mod._compile(compiled.outputText,filename);
    };
    try {
      const {mobileApi}=requireFromRoot("./apps/mobile/src/experience/feed-api.ts");
      const {describeMobileSearchResult,connectedSearchWebLink}=requireFromRoot(
        "./apps/mobile/src/ux004/discovery/connectedSearchResult.ts");
      const {getSearchHustler,matchedPublishedOffers,currentSearchOffer,
        searchHustlerPublicLink}=requireFromRoot(
          "./apps/mobile/src/ux004/discovery/connectedOpportunity.ts");
      const {enquiryServiceId,currentEnquirySlots,enquirySlotLabel}=requireFromRoot(
        "./apps/mobile/src/ux004/discovery/connectedOpportunityAvailability.ts");
      const {appendUniqueSearchResults}=requireFromRoot(
        "./apps/mobile/src/ux004/discovery/connectedSearchPagination.ts");

      const pages={};
      for(const tab of ["people","posts","services","products"]) {
        pages[tab]=await mobileApi.searchTab(clientToken,tab,"tailoring");
        assert.ok(Array.isArray(pages[tab].items),"actual mobile adapter "+tab+" array");
        assert.equal(pages[tab].hasMore, false);
      }
      const providerRow=pages.people.items.find(x=>x.kind==="person"&&x.id===hustler.id);
      const postRow=pages.posts.items.find(x=>x.kind==="post"&&x.id===post.id);
      const serviceRow=pages.services.items.find(x=>x.kind==="service"&&x.id===service.id);
      const productRow=pages.products.items.find(x=>x.kind==="product"&&x.id===product.id);
      assert.ok(providerRow&&postRow&&serviceRow&&productRow,"mobile actually receives all types");
      assert.equal(describeMobileSearchResult(serviceRow).title,"Tailor a test outfit");
      assert.equal(describeMobileSearchResult(productRow).title,"Tailoring fabric sample");
      assert.equal(getSearchHustler(providerRow).id,hustler.id);
      assert.equal(getSearchHustler(postRow).id,hustler.id);
      assert.equal(getSearchHustler(serviceRow).id,hustler.id);
      assert.equal(currentSearchOffer(serviceRow).id,service.id);
      const matched=matchedPublishedOffers(
        [...pages.services.items,...pages.products.items],postRow);
      assert.deepEqual(new Set(matched.map(x=>x.kind+":"+x.id)),new Set([
        "service:"+service.id,"service:"+queuedService.id,"product:"+product.id
      ]));
      assert.equal(searchHustlerPublicLink(postRow,undefined),null);
      assert.equal(searchHustlerPublicLink(postRow,"https://hustle.test"),
        "https://hustle.test/u/"+hustler.username);
      assert.equal(connectedSearchWebLink(serviceRow,"https://hustle.test"),
        "https://hustle.test/services/"+service.id);
      assert.equal(connectedSearchWebLink(serviceRow,"http://untrusted.example"),null);
      console.log("PASS: Real Expo mobile adapter → published search → canonical Hustler/offer projection");

      const mobileFirst=await mobileApi.searchTab(clientToken,"top","tailoring");
      assert.ok(mobileFirst.items.length>0);
      const smallPathSearch=await mobileApi.searchTab(clientToken,"top","tailoring");
      assert.equal(smallPathSearch.items[0].id,mobileFirst.items[0].id);
      const merged=appendUniqueSearchResults(mobileFirst.items,mobileFirst.items);
      assert.equal(merged.length,mobileFirst.items.length);
      await assert.rejects(()=>mobileApi.searchTab("incorrect","top","tailoring"),
        /Hustle request failed|Invalid|token|Unauthorized/i);
      await assert.rejects(()=>mobileApi.searchTab("","top","tailoring"),
        /Sign in to use Hustle/);
      console.log("PASS: Mobile query adapter, stable search order, duplicate guard and invalid-token denial");

      assert.equal(enquiryServiceId(serviceRow),service.id);
      assert.equal(enquiryServiceId(productRow),null);
      const mobileSlots=await mobileApi.slots(clientToken,
        enquiryServiceId(serviceRow),future);
      assert.equal(mobileSlots.mode,"APPOINTMENT");
      assert.equal(mobileSlots.date,future);
      assert.equal(mobileSlots.timezone,"Africa/Lagos");
      const available=currentEnquirySlots(mobileSlots);
      assert.ok(available.every(x=>x.available&&x.remainingCapacity>0));
      if(available.length)assert.ok(enquirySlotLabel(
        available[0].startAt,mobileSlots.timezone));
      const mobileQueue=await mobileApi.slots(clientToken,queuedService.id,future);
      assert.equal(mobileQueue.mode,"WORK_QUEUE");
      assert.deepEqual(currentEnquirySlots(mobileQueue),[]);
      console.log("PASS: Real Expo mobile slots adapter → actual schedule → safe unsent-enquiry time projection");
    } finally {
      if(oldTsHandler)ModuleRuntime._extensions[".ts"]=oldTsHandler;
      else delete ModuleRuntime._extensions[".ts"];
      delete process.env.EXPO_PUBLIC_API_URL;
    }


    assert.equal(await prisma.booking.count(),0);
    assert.equal(await prisma.paymentAttempt.count(),0);
    assert.equal(await prisma.escrowRecord.count(),0);
    assert.equal(await prisma.systemEvent.count(),0);
    assert.ok(client.id && product.id && post.id);
    console.log("PASS: No booking, payments, escrow or search analytics were created");
    console.log("PASS: Isolated, free local connected-API acceptance; external Supabase auth, public staging and phone QA remain NOT TESTED");
  } finally {
    await app.close();
  }
}
run().catch(error=>{
  console.error("ISOLATED ACCEPTANCE FAILED:",error?.message||String(error));
  process.exitCode=1;
});
