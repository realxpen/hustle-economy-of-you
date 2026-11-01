import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../worker.mjs";
const root=new URL("../",import.meta.url);
const source=file=>readFileSync(new URL(file,root),"utf8");
const url="https://hustle.example";
const gated={HUSTLE_PREVIEW_AUTH_GATE:"isolated-staging",ASSETS:{fetch:async()=>new Response("V1 static asset")}};
const req=(pathname,method="GET",body,origin=url,cookie)=>new Request(url+pathname,{
 method,headers:{...(method==="GET"?{}:{origin,"content-type":"application/json"}),
  ...(cookie?{cookie}:{})},...(method==="GET"?{}:{body:JSON.stringify(body??{})})});
const sessionCookie="hustle-staging.session_token=test-cookie";
async function stub(fn,run){const previous=globalThis.fetch;globalThis.fetch=fn;try{return await run();}finally{globalThis.fetch=previous;}}
function asJSON(value,status=200,cookie){const headers=new Headers({"content-type":"application/json"});
 if(cookie)headers.append("set-cookie",cookie);
 return new Response(JSON.stringify(value),{status,headers});}
test("The V1 static site remains the asset fallback; no authentication without preview gate",async()=>{
 assert.equal((await worker.fetch(req("/"),gated)).status,200);
 assert.equal((await worker.fetch(req("/api/preview/auth/session"),{...gated,HUSTLE_PREVIEW_AUTH_GATE:"off"})).status,404);
 assert.equal((await worker.fetch(req("/api/preview/finance"),gated)).status,404);
 for(const route of ["/api/preview/bookings","/api/preview/wallet","/api/preview/escrow","/api/preview/admin","/api/preview/proxy"]){
  assert.equal((await worker.fetch(req(route,"POST"),gated)).status,404);
 }
});
test("Cross-origin requests and malformed credentials are blocked before upstream",async()=>{
 await stub(()=>{throw Error("Upstream must not be reached");},async()=>{
  assert.equal((await worker.fetch(req("/api/preview/auth/sign-in","POST",{email:"a@b.co",password:"validpassword123"},"https://evil.test"),gated)).status,403);
  assert.equal((await worker.fetch(req("/api/preview/auth/sign-in","POST",{email:"a@b.co",password:"123456"}),gated)).status,400);
  assert.equal((await worker.fetch(req("/api/preview/auth/sign-up","POST",{email:"invalid",password:"validpassword123"}),gated)).status,400);
  assert.equal((await worker.fetch(req("/api/preview/account"),gated)).status,401);
 });
});
test("Signed-in cookie is HttpOnly and only the pinned isolated host sees credentials",async()=>{
 const seen=[];
 await stub(async(target,init)=>{
  seen.push({target,init});
  return asJSON({user:{id:"u_1",email:"qa@example.test"},session:{token:"opaque-secret",expiresAt:new Date(Date.now()+3600000).toISOString()}},
   200,"hustle-staging.session_token=sensitive; Path=/api/auth; SameSite=Lax");
 },async()=>{
  const response=await worker.fetch(req("/api/preview/auth/sign-in","POST",{
   email:"QA@example.test",password:"safe-password-1234"}),gated);
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true});
  const cookies=response.headers.getSetCookie();
  assert.equal(cookies.length,1);
  assert.match(cookies[0],/HttpOnly/);assert.match(cookies[0],/Secure/);
  assert.match(cookies[0],/Path=\//);
  assert.doesNotMatch(cookies[0],/Domain=/);
  assert.equal(seen.length,1);
  assert.equal(seen[0].target,"https://hustle-isolated-staging-api.vercel.app/api/auth/sign-in/email");
  assert.equal(JSON.parse(seen[0].init.body).email,"qa@example.test");
  assert.equal(seen[0].init.redirect,"manual");
 });
});
test("Session and account routes do not expose opaque bearer or other users",async()=>{
 const seen=[];
 await stub(async(target,init)=>{
  seen.push({target,init});
  if(String(target).endsWith("/api/auth/get-session"))
    return asJSON({session:{token:"opaque-secret",expiresAt:new Date(Date.now()+3600000).toISOString()},
      user:{id:"u_1",email:"qa@example.test",secret:"internal"}});
  if(String(target).endsWith("/api/v1/auth/me"))
    return asJSON({id:"u_1",displayName:"QA",username:"qa",capabilities:[{capability:"CLIENT",status:"ACTIVE"}]});
  if(String(target).endsWith("/api/v1/auth/sync"))
    return asJSON({id:"u_1",username:null,onboardingCompleted:false});
  throw Error("Unexpected URL: "+target);
 },async()=>{
  const cookie=sessionCookie;
  const session=await worker.fetch(req("/api/preview/auth/session","GET",null,url,cookie),gated);
  const text=await session.text();
  assert.equal(JSON.parse(text).authenticated,true);
  assert.equal(text.includes("opaque-secret"),false);
  assert.equal(text.includes("internal"),false);
  const account=await worker.fetch(req("/api/preview/account","GET",null,url,cookie),gated);
  assert.equal((await account.json()).username,"qa");
  const synced=await worker.fetch(req("/api/preview/account/sync","POST",{},url,cookie),gated);
  assert.equal((await synced.json()).onboardingCompleted,false);
  assert.equal(seen.filter(x=>x.target.endsWith("/api/v1/auth/sync")).length,1);
  for(const x of seen.filter(x=>x.target.includes("/api/v1/auth/")))
    assert.equal(x.init.headers.get("authorization"),"Bearer opaque-secret");
 });
});
test("Profile update requires a valid server-side identity and rejects fake ownership",async()=>{
 let patches=0;
 await stub(async(target,init)=>{
  if(String(target).endsWith("/api/auth/get-session"))
    return asJSON({session:{token:"opaque-secret",expiresAt:new Date(Date.now()+3600000).toISOString()},user:{id:"u_1"}});
  patches++;
  assert.equal(target,"https://hustle-isolated-staging-api.vercel.app/api/v1/auth/profile");
  assert.equal(init.headers.get("authorization"),"Bearer opaque-secret");
  return asJSON({id:"u_1",displayName:"Test User",username:"tester",onboardingCompleted:true});
 },async()=>{
  const cookie=sessionCookie;
  assert.equal((await worker.fetch(req("/api/preview/account","PATCH",{username:"tester",displayName:""},url,cookie),gated)).status,400);
  assert.equal((await worker.fetch(req("/api/preview/account","PATCH",{username:"../admin",displayName:"Test"},url,cookie),gated)).status,400);
  assert.equal(patches,0);
  const response=await worker.fetch(req("/api/preview/account","PATCH",
   {username:"Tester",displayName:"Test User",bio:"",location:"Yaba"},url,cookie),gated);
  assert.equal(response.status,200);assert.equal((await response.json()).username,"tester");
  assert.equal(patches,1);
 });
});
test("The approved UI keeps its original navigation and removes simulated login authority",()=>{
 const html=source("dist/index.html"),journey=source("dist/hustle-journeys.js");
 const flows=source("dist/hustle-flows.js"),auth=source("dist/hustle-auth.js");
 assert.ok(html.indexOf("hustle-auth.js")<html.indexOf("hustle-flows.js"));
 assert.ok(html.includes("hustle-journeys.js"));
 assert.ok(html.includes("hustle-adaptive-ui.js"));
 assert.match(journey,/window.HustleAuth\.enter/);
 assert.match(journey,/window.HustleAuth\.update/);
 assert.match(journey,/window.HustleAuth\.exit/);
 assert.doesNotMatch(journey,/get\("otp"\)!=="123456"/);
 assert.match(journey,/state\.onboardStep=2;renderToast/);
 assert.match(flows,/window.HustleAuth\.update/);
 assert.match(flows,/HustleAuth\?\.isSignedIn/);
 assert.doesNotMatch(auth,/localStorage|sessionStorage/);
 assert.doesNotMatch(auth,/NEXT_PUBLIC_SUPABASE_URL|PAYSTACK|ESCROW/);
});
