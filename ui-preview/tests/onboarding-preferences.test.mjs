import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import worker from "../worker.mjs";

const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const window={};
vm.runInNewContext(source("../dist/hustle-onboarding-pickers.js"),{window});
vm.runInNewContext(source("../dist/hustle-onboarding-ui.js"),{window});
const p=window.HustleOnboardingPickers,ui=window.HustleOnboardingUI;

test("Skill and interest catalogues are separate, populated and searchable",()=>{
 assert.ok(p.skills.length>=70,"local professions must include a useful broad catalogue");
 assert.ok(p.interests.length>=35);
 assert.equal(p.bySkill("barbering").name,"Barbering");
 assert.equal(p.bySkill("plumbing").category,"Home & construction");
 assert.ok(p.findSkills("hair").some(x=>x.name==="Hairdressing"));
 assert.ok(p.findSkills("repair").some(x=>x.name==="Phone repair"));
 assert.equal(p.findSkills("unusual_unknown_skill").length,0);
 assert.equal(new Set(p.skills.map(x=>x.name)).size,p.skills.length);
 assert.equal(new Set(p.interests.map(x=>x.name)).size,p.interests.length);
 assert.ok(p.interests.some(x=>x.name==="Cooking"));
 assert.ok(p.interests.some(x=>x.name==="Music"));
 assert.equal(p.interestLimit,10);
});
test("UI displays skill as one choice, interests as independent multiple choices",()=>{
 const skill=ui.skills("Barbering","Barb");
 assert.match(skill,/Primary skill/);
 assert.match(skill,/Barbering/);
 assert.match(skill,/skill-clear/);
 assert.doesNotMatch(skill,/interest-toggle/);
 const interest=ui.interests(["Music","Food"],true);
 assert.match(interest,/aria-pressed="true"/);
 assert.match(interest,/2\/10 selected/);
 assert.match(interest,/Music/);
 assert.match(interest,/Food/);
 assert.match(interest,/Show fewer/);
 assert.doesNotMatch(interest,/data-hj="skill-select"/);
});
test("Area is a locality selector, map preview loads only after explicit request",()=>{
 assert.ok(p.areas.length>=35);
 assert.equal(p.byArea("Ikeja, Lagos").label,"Ikeja, Lagos");
 assert.ok(p.findAreas("Abuja").length>=1||p.findAreas("FCT").length>=1);
 const noMap=ui.area("Yaba, Lagos","Yaba",false);
 assert.match(noMap,/Yaba, Lagos/);
 assert.match(noMap,/Allow location/);
 assert.match(noMap,/data-hj="area-map-toggle"/);
 assert.doesNotMatch(noMap,/<iframe/);
 const map=ui.area("Yaba, Lagos","Yaba",true);
 assert.match(map,/www\.openstreetmap\.org/);
 assert.match(map,/<iframe/);
 assert.equal(p.previewMap("unknown city"),"");
 assert.equal(p.approximateArea(0,0),null);
 assert.equal(p.approximateArea(NaN,1),null);
 assert.equal(p.approximateArea(6.515,3.372).label,"Yaba, Lagos");
});
test("Unknown locality text is escaped and cannot inject markup into UI",()=>{
 const html=ui.area("","<img src=x onerror=alert(1)>",false);
 assert.doesNotMatch(html,/<img src=/);
 assert.match(html,/&lt;img/);
 const q=ui.skills("","<script>test</script>");
 assert.doesNotMatch(q,/<script>/);
});
test("Backend schema stores interests separately without changing capabilities or payments",()=>{
 const schema=source("../../apps/api/prisma/schema.prisma");
 const service=source("../../apps/api/src/auth/auth.service.ts");
 const migration=source("../../apps/api/prisma/migrations/20261101180000_account_discovery_preferences/migration.sql");
 const user=schema.split("model User {")[1]?.split("\n}")[0];
 assert.match(user,/primarySkill\s+String\?/);
 assert.match(user,/interests\s+String\[\]\s+@default\(\[\]\)/);
 assert.match(service,/optionalInterests/);
 assert.match(service,/value\.length > 10/);
 assert.match(service,/new Set/);
 assert.match(service,/primarySkill !== undefined/);
 assert.match(service,/interests !== undefined/);
 assert.match(migration,/ALTER TABLE "User"/);
 assert.match(migration,/ADD COLUMN "primarySkill"/);
 assert.match(migration,/ADD COLUMN "interests"/);
 assert.doesNotMatch(migration.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n"),/DROP TABLE|DELETE FROM|UPDATE\s+"Booking"|ALTER TABLE\s+"Payment"|ALTER TABLE\s+"Escrow"/i);
});
test("V1 onboarding has six distinct steps, server persistence and no silent GPS",()=>{
 const journey=source("../dist/hustle-journeys.js");
 const html=source("../dist/index.html");
 const flows=source("../dist/hustle-flows.js");
 assert.ok(html.indexOf("hustle-onboarding-pickers.js")<html.indexOf("hustle-onboarding-ui.js"));
 assert.ok(html.indexOf("hustle-onboarding-ui.js")<html.indexOf("hustle-journeys.js"));
 assert.match(journey,/\["Goal","About you","Your skill","Interests","Area","Ready"\]/);
 assert.match(journey,/window\.HustleOnboardingUI\?\.skills/);
 assert.match(journey,/window\.HustleOnboardingUI\?\.interests/);
 assert.match(journey,/window\.HustleOnboardingUI\?\.area/);
 assert.match(journey,/primarySkill:data\.onboarding\.skill/);
 assert.match(journey,/interests:data\.onboarding\.interests/);
 assert.match(journey,/window\.HustleAuth\.update/);
 assert.match(journey,/case "area-geolocate"/);
 assert.match(journey,/navigator\.geolocation\.getCurrentPosition/);
 assert.doesNotMatch(journey,/navigator\.geolocation\.watchPosition/);
 assert.match(flows,/edit-discovery/);
 assert.match(flows,/signedIn\.interests/);
 assert.ok(html.includes("hustle-flows.js"));
 assert.ok(html.includes("hustle-operations.js"));
});
const base="https://hustle.example",cookie="hustle-staging.session_token=test";
const env={HUSTLE_PREVIEW_AUTH_GATE:"isolated-staging",ASSETS:{fetch:async()=>new Response("index")}};
const patch=body=>new Request(base+"/api/preview/account",{method:"PATCH",headers:{origin:base,cookie,"content-type":"application/json"},body:JSON.stringify(body)});
test("Worker forwards only bounded first-party profile interests, never GPS",async()=>{
 const prev=globalThis.fetch,seen=[];
 globalThis.fetch=async(url,init)=>{
  seen.push({url,init});
  if(String(url).endsWith("/api/auth/get-session"))
   return new Response(JSON.stringify({session:{token:"test-token",expiresAt:new Date(Date.now()+100000).toISOString()},user:{id:"test-id"}}),{headers:{"content-type":"application/json"}});
  if(String(url).endsWith("/api/v1/auth/profile"))
   return new Response(JSON.stringify({id:"test-id",primarySkill:"Barbering",interests:["Food","Music"]}),{headers:{"content-type":"application/json"}});
  throw Error("Unexpected upstream route");
 };
 try{
  const body={displayName:"Test User",username:"testuser",location:"Yaba, Lagos",primarySkill:"Barbering",interests:["Food","Music"]};
  let r=await worker.fetch(patch(body),env);
  assert.equal(r.status,200);
  const profileCall=seen.find(x=>String(x.url).endsWith("/api/v1/auth/profile"));
  assert.deepEqual(JSON.parse(profileCall.init.body),body);
  assert.equal(profileCall.init.headers.get("authorization"),"Bearer test-token");
  assert.equal(JSON.stringify(profileCall.init.body).includes("latitude"),false);
  r=await worker.fetch(patch({...body,interests:Array(11).fill("Food")}),env);
  assert.equal(r.status,400);
  r=await worker.fetch(patch({...body,interests:["Food","food"]}),env);
  assert.equal(r.status,400);
  r=await worker.fetch(patch({...body,primarySkill:Array(90).fill("x").join("")}),env);
  assert.equal(r.status,400);
  assert.equal(seen.filter(x=>String(x.url).endsWith("/api/v1/auth/profile")).length,1);
 }finally{globalThis.fetch=prev;}
});
