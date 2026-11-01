import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import worker from "../worker.mjs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
const window={};
vm.runInNewContext(source("../dist/hustle-account-setup.js"),{window});
vm.runInNewContext(source("../dist/hustle-identity-ui.js"),{window});
const u=window.HustleAccountSetup,ui=window.HustleIdentityUI;
test("Username handles are normalized, suggested and validated independently",()=>{
 assert.equal(u.normalize("Alex Smith"),"alexsmith");
 assert.equal(u.valid("alex.smith"),true);
 for(const bad of ["admin!","aa","..test","alice..b",".bad","bad."])assert.equal(u.valid(bad),false);
 const options=u.suggestions("Alex Smith");
 assert.ok(options.length>=3);
 assert.ok(options.every(u.valid));
 assert.equal(new Set(options).size,options.length);
 const view=ui.username("Alex Smith","alexsmith",{username:"alexsmith",available:true},false);
 assert.match(view,/Username available|✓ Available|✓/);
 assert.match(view,/aria-live="polite"/);
 assert.match(view,/data-hj="username-suggest"/);
 assert.match(view,/autocomplete="username"/);
});
test("Photo selection is genuinely optional and not falsely persisted",()=>{
 const empty=ui.photo("",false,false,"");
 assert.match(empty,/type="file"/);
 assert.match(empty,/image\/jpeg,image\/png,image\/webp/);
 assert.match(empty,/optional/);
 assert.doesNotMatch(empty,/<img/);
 const preview=ui.photo("blob:temporary",false,false,"Storage not configured");
 assert.match(preview,/<img/);
 assert.match(preview,/Photo preview|unsaved preview/i);
 assert.match(preview,/Storage not configured/);
 assert.match(ui.photo("https://example.test/profile.webp",true,false,""),/Photo saved/);
});
test("Source uses eight actual separate screens and honest social auth limitations",()=>{
 const journey=source("../dist/hustle-journeys.js");
 const auth=source("../dist/hustle-auth.js");
 const html=source("../dist/index.html");
 const svc=source("../../apps/api/src/auth/auth.service.ts");
 const ctl=source("../../apps/api/src/auth/auth.controller.ts");
 assert.match(journey,/\["Goal","Display name","Username","Photo","Skill","Interests","Area","Ready"\]/);
 assert.match(journey,/HustleIdentityUI\?\.username/);
 assert.match(journey,/HustleIdentityUI\?\.photo/);
 assert.match(journey,/case "username-suggest"/);
 assert.match(journey,/case "area-geolocate"/);
 assert.match(journey,/hjAvatarFile/);
 assert.match(journey,/window\.HustleAuth\.usernameAvailability/);
 assert.match(journey,/window\.HustleAuth\.uploadAvatar/);
 assert.match(journey,/Continue with Google · Not enabled/);
 assert.match(journey,/Continue with Apple · Not enabled/);
 assert.match(journey,/Continue as guest/);
 assert.match(journey,/Recovery will be enabled after email delivery is configured/);
 assert.ok(html.indexOf("hustle-account-setup.js")<html.indexOf("hustle-identity-ui.js"));
 assert.ok(html.indexOf("hustle-identity-ui.js")<html.indexOf("hustle-journeys.js"));
 assert.match(auth,/async function usernameAvailability/);
 assert.match(auth,/async function uploadAvatar/);
 assert.match(svc,/this\.reservedHandles/);
 assert.match(svc,/where:\{ username:original \}/);
 assert.match(ctl,/@Get\("username-availability"\)/);
});
const origin="https://hustle.example";
const gate={HUSTLE_PREVIEW_AUTH_GATE:"isolated-staging",ASSETS:{fetch:async()=>new Response("site")}};
const cookie="hustle-staging.session_token=opaque-cookie";
const req=(path,method="GET",body,extra={})=>new Request(origin+path,{method,
 headers:{...(method==="GET"?{}:{origin,"content-type":"image/webp"}),cookie,...extra},
 ...(body!==undefined?{body}:{})});
const json=data=>new Response(JSON.stringify(data),{headers:{"content-type":"application/json"}});
test("Username lookup is session authenticated and never exposes bearer",async()=>{
 const calls=[],prev=globalThis.fetch;
 globalThis.fetch=async(path,init)=>{
  calls.push({path,init});
  if(String(path).endsWith("/api/auth/get-session"))return json({
    user:{id:"test-account"},session:{token:"secret-session",expiresAt:new Date(Date.now()+60000).toISOString()}});
  if(String(path).includes("username-availability"))
   return json({username:"alexsmith",available:true,reason:null});
  throw Error("Unrecognized backend route");
 };
 try{
  const response=await worker.fetch(req("/api/preview/account/username?username=alexsmith"),gate);
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.available,true);
  assert.equal(JSON.stringify(data).includes("secret-session"),false);
  const target=calls.find(x=>String(x.path).includes("username-availability"));
  assert.equal(target.init.headers.get("authorization"),"Bearer secret-session");
  assert.equal((await worker.fetch(req("/api/preview/account/username?username="+("a".repeat(40))),gate)).status,400);
 }finally{globalThis.fetch=prev;}
});
test("Avatar route is fail-closed with no R2 binding; finance routes remain denied",async()=>{
 const bytes=new Uint8Array(20);bytes.set(new TextEncoder().encode("RIFF"),0);bytes.set(new TextEncoder().encode("WEBP"),8);
 assert.equal((await worker.fetch(req("/api/preview/account/avatar","POST",bytes),gate)).status,503);
 assert.equal((await worker.fetch(req("/api/preview/avatar/00000000-0000-4000-a000-000000000000.webp"),gate)).status,404);
 assert.equal((await worker.fetch(req("/api/preview/escrow/release","POST",bytes),gate)).status,404);
});
