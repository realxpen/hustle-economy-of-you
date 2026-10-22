#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "../..");
const read = p => fs.readFileSync(path.join(repo,p),"utf8");
const compilerOptions={target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true};
const prior=Module._extensions[".ts"];
Module._extensions[".ts"]=(mod,filename)=>{
  const source=fs.readFileSync(filename,"utf8");
  const out=ts.transpileModule(source,{compilerOptions,reportDiagnostics:true});
  assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,filename);
  mod._compile(out.outputText,filename);
};
const target=path.join(root,"src/ux004/discovery/connectedOpportunity.ts");
const source=fs.readFileSync(target,"utf8");
for(const match of source.matchAll(/(?:import type|import)\s+.*?\s+from ["']([^"']+)["']/g)){
  assert.ok(fs.existsSync(path.resolve(path.dirname(target),match[1]+".ts")),"Unresolvable import: "+match[1]);
}
const {getSearchHustler,matchedPublishedOffers,currentSearchOffer,searchHustlerPublicLink}=require(target);
const app=read("apps/mobile/src/experience/MobileExperience.tsx");
const api=read("apps/mobile/src/experience/feed-api.ts");
const backend=read("apps/api/src/search/search.service.ts");
const qa=read("apps/mobile/docs/MOBILE_A33_CONNECTED_OPPORTUNITY.md");
function check(label,fn){fn();console.log("PASS "+label);}
const person={kind:"person",id:"user-1",person:{
  id:"user-1",displayName:"Example Tailor",username:"example.tailor",
  location:"Yaba",verified:true,bio:"Makes bespoke clothing",professionalProfile:{primarySkill:"Tailoring",headline:"Custom fashion"}
},url:"/u/example.tailor"};
const post={kind:"post",id:"post-1",post:{caption:"Finishing sample"},owner:{
  id:"user-1",displayName:"Example Tailor",username:"example.tailor",location:"Yaba"
},url:"/posts/post-1"};
const service={kind:"service",id:"service-1",service:{
  title:"Custom fitting",description:"Measurements and alterations",priceMinor:200000,currency:"NGN"
},owner:{id:"user-1",displayName:"Example Tailor",username:"example.tailor"},url:"/services/service-1"};
const product={kind:"product",id:"product-1",product:{
  title:"Fabric sample",priceMinor:250000
},owner:{id:"user-1",displayName:"Example Tailor",username:"example.tailor"},url:"/products/product-1"};
const other={kind:"service",id:"service-2",service:{title:"Unrelated barber"},owner:{
  id:"user-2",displayName:"Example Tailor",username:"another"
},url:"/services/service-2"};
const withoutId={kind:"service",id:"service-3",service:{title:"Unknown owner"},owner:{
  displayName:"Example Tailor",username:"example.tailor"
},url:"/services/service-3"};

check("Canonical SearchService returns published-only owned identities and offers",()=>{
  assert.match(backend,/private publicOwner\(profile: ProfessionalContext\)/);
  assert.match(backend,/id: owner\.id,/);
  assert.match(backend,/user:\s*\{\s*capabilities:\s*\{\s*some: \{ capability: Capability\.HUSTLER, status: CapabilityStatus\.ACTIVE \}/);
  assert.match(backend,/status: ServiceStatus\.PUBLISHED/);
  assert.match(backend,/status: ProductStatus\.PUBLISHED/);
  assert.match(backend,/status: ProfessionalProfileStatus\.PUBLISHED/);
  assert.match(api,/owner\?: \{\s*id\?: string/);
  assert.match(api,/person\?: \{\s*id\?: string/);
});
check("Person, post, and offer all show source-backed Hustler identity",()=>{
  assert.deepEqual(getSearchHustler(person),{
    id:"user-1",name:"Example Tailor",username:"example.tailor",
    skill:"Tailoring",headline:"Custom fashion",summary:"Makes bespoke clothing",location:"Yaba",contactVerified:true
  });
  assert.equal(getSearchHustler(post).id,"user-1");
  assert.equal(getSearchHustler(service).name,"Example Tailor");
  assert.equal(getSearchHustler(other).id,"user-2");
  assert.equal(getSearchHustler(withoutId).id,null);
  assert.equal(getSearchHustler({kind:"person",id:"u4",person:{}}).name,"Published Hustler");
});
check("Never infer ownership from names or captions; only matching returned owner ID",()=>{
  const items=[person,post,service,product,other,withoutId,service];
  const original=JSON.stringify(items);
  const own=matchedPublishedOffers(items,person);
  assert.deepEqual(own.map(x=>x.id),["service-1","product-1"]);
  assert.deepEqual(matchedPublishedOffers(items,post).map(x=>x.id),["service-1","product-1"]);
  assert.deepEqual(matchedPublishedOffers(items,service).map(x=>x.id),["service-1","product-1"]);
  assert.deepEqual(matchedPublishedOffers(items,other).map(x=>x.id),["service-2"]);
  assert.deepEqual(matchedPublishedOffers(items,withoutId).map(x=>x.id),["service-3"]);
  assert.deepEqual(matchedPublishedOffers(items,{kind:"person",id:"unmatched",person:{displayName:"Example Tailor"}}),[]);
  assert.equal(JSON.stringify(items),original,"must not mutate canonical results");
});
check("Only source-backed product/service details are used; do not synthesize prices",()=>{
  assert.equal(currentSearchOffer(person),null);
  assert.equal(currentSearchOffer(post),null);
  assert.equal(currentSearchOffer(service).title,"Custom fitting");
  assert.equal(currentSearchOffer(product).title,"Fabric sample");
  assert.equal(currentSearchOffer({kind:"service",id:"empty"}),null);
  assert.equal(currentSearchOffer({kind:"product",id:"empty"}),null);
});
check("Returned Hustler username can open only an explicitly configured canonical HTTPS profile",()=>{
  assert.equal(searchHustlerPublicLink(service,"https://hustle.test"),"https://hustle.test/u/example.tailor");
  assert.equal(searchHustlerPublicLink(person,"https://hustle.test"),"https://hustle.test/u/example.tailor");
  assert.equal(searchHustlerPublicLink(service,undefined),null);
  assert.equal(searchHustlerPublicLink(other,"javascript:alert(1)"),null);
  assert.equal(searchHustlerPublicLink({...service,owner:{id:"user-1",username:"other/site"}},"https://hustle.test"),null);
  assert.equal(searchHustlerPublicLink({...service,owner:{username:"example.tailor"}},"https://hustle.test"),null);
});
check("Search opens local profile, actual same-owner offers and a draft-only enquiry",()=>{
  assert.match(app,/onPress=\{\(\) => openOpportunity\(result\)\}/);
  assert.match(app,/function openOpportunity\(item: SearchResult\)/);
  assert.match(app,/setOpportunityMatches\(matchedPublishedOffers\(searchResults, item\)\)/);
  assert.match(app,/setOpportunityStage\('profile'\)/);
  assert.match(app,/opportunityStage === 'profile'/);
  assert.match(app,/opportunityStage === 'offer'/);
  assert.match(app,/opportunityStage === 'enquiry'/);
  assert.match(app,/opportunityMatches\.map\(offerResult =>/);
  assert.match(app,/const offer = currentSearchOffer\(offerResult\)/);
  assert.match(app,/No offers were included in these search results\. This does not mean the Hustler has none/);
  assert.match(app,/setOpportunitySelectedOffer\(offerResult\); setOpportunityStage\('offer'\)/);
  assert.match(app,/setOpportunityStage\('enquiry'\)/);
  assert.match(app,/accessibilityLabel="Describe your booking enquiry"/);
  assert.match(app,/maxLength=\{1200\}/);
  assert.match(app,/onChangeText=\{value => \{\s*setEnquiryDraft\(value\); setEnquiryReviewed\(false\)/);
  assert.match(app,/disabled=\{!enquiryDraft\.trim\(\)\}/);
  assert.match(app,/Enquiry prepared — not sent/);
  assert.match(app,/No provider has received this enquiry/);
  const block=app.slice(app.indexOf("    <Modal visible={opportunityStage"),app.indexOf("  </View>;\n}\nexport function MobileExperience"));
  assert.doesNotMatch(block,/mobileApi\.(requestBooking|comment|like|save|follow|event)\s*\(/);
  assert.doesNotMatch(block,/Share\.share|fetch\s*\(|initializePayment|checkout|escrow\.release/);
});
check("Feed booking permissions, search paging and A1 rollback unaffected",()=>{
  assert.match(app,/if \(process\.env\.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== 'true'\)/);
  assert.match(app,/const offerService = active\?\.services\.find/);
  assert.match(app,/searchMorePending\.current/);
  assert.match(app,/setSearchResults\(old => appendUniqueSearchResults\(old, page\.items\)\)/);
  assert.match(app,/function closeOpportunity\(\)/);
  assert.match(app,/onRequestClose=\{closeOpportunity\}/);
  assert.match(qa,/Runtime acceptance: PENDING/);
  assert.match(qa,/No Expo APK/);
  assert.ok(read("apps/mobile/scripts/mobile-experience-contract.mjs").includes("mobile-a33-connected-opportunity-contract.cjs"));
});
console.log("A3.3 connected opportunity source/logic PASS; device/authenticated real API acceptance PENDING.");
