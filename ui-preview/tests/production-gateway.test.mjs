import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { handleProductionApi } from "../production-gateway.mjs";
import worker from "../worker.mjs";

const ui="https://hustle-economy-of-you.realxpens.workers.dev";
const aws="https://abcdefghijklmnop.lambda-url.eu-west-2.on.aws";
const sb="https://pfgarmyygybmhiiuopym.supabase.co";
const env={HUSTLE_UI_API_MODE:"aws-production",HUSTLE_PRODUCTION_API_ORIGIN:aws,
 HUSTLE_SUPABASE_PUBLISHABLE_KEY:"sb_publishable_"+"a".repeat(28),
 ASSETS:{fetch:async()=>new Response("Hustle V1 static")}};
const req=(path,method="GET",data,extra={})=>new Request(ui+path,{
 method,headers:{...(method!=="GET"?{origin:ui,"content-type":"application/json"}:{}),...extra},
 ...(data===undefined?{}:{body:JSON.stringify(data)})});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json"}});
const access="a".repeat(33),refresh="r".repeat(32);
const user={id:"user-123",email:"test@example.com"};
function sessionCookie(){return "__Host-hustle_prod_at="+access+"; __Host-hustle_prod_rt="+refresh;}
async function mock(fn,body){const prev=globalThis.fetch;globalThis.fetch=fn;try{return await body()}finally{globalThis.fetch=prev;}}

test("Production mode fails closed without exact AWS and Supabase config",async()=>{
 let res=await worker.fetch(req("/api/preview/auth/session"),{...env,HUSTLE_PRODUCTION_API_ORIGIN:null});
 assert.equal(res.status,503);
 res=await worker.fetch(req("/api/preview/auth/session"),{...env,HUSTLE_PRODUCTION_API_ORIGIN:"https://hustle-isolated-staging-api.vercel.app"});
 assert.equal(res.status,503);
 res=await worker.fetch(req("/api/preview/auth/session"),{...env,HUSTLE_SUPABASE_PUBLISHABLE_KEY:"bad"});
 assert.equal(res.status,503);
 assert.equal((await worker.fetch(req("/"),env)).status,200);
 assert.equal((await worker.fetch(req("/api/preview/wallet"),env)).status,404);
 for(const path of ["/api/preview/escrow","/api/preview/admin","/api/preview/bookings","/api/preview/payments","/api/preview/proxy"]){
  assert.equal((await worker.fetch(req(path,"POST",{}),env)).status,404);
 }
});
test("Cross-origin auth writes are denied before Supabase can be called",async()=>{
 await mock(()=>{throw Error("unexpected production call");},async()=>{
  const res=await handleProductionApi(req("/api/preview/auth/sign-in","POST",
   {email:"test@example.com",password:"valid-password-1234"},{origin:"https://evil.example"}),env);
  assert.equal(res.status,403);
  assert.equal((await worker.fetch(req("/api/preview/auth/sign-in","POST",
   {email:"test@example.com",password:"123456"}),env)).status,400);
 });
});
test("Production login sets host-only HttpOnly cookies, never returns raw JWT",async()=>{
 const seen=[];
 await mock(async(url,init)=>{seen.push({url,init});return json({access_token:access,refresh_token:refresh,expires_in:3600})},async()=>{
  const r=await worker.fetch(req("/api/preview/auth/sign-in","POST",{
   email:"Test@Example.com",password:"valid-password-1234"}),env);
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true});
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,sb+"/auth/v1/token?grant_type=password");
  assert.equal(JSON.parse(seen[0].init.body).email,"test@example.com");
  const cookies=r.headers.getSetCookie();
  assert.equal(cookies.length,2);
  for(const c of cookies){assert.match(c,/HttpOnly/);assert.match(c,/Secure/);
   assert.match(c,/SameSite=Lax/);assert.match(c,/Path=\//);assert.doesNotMatch(c,/Domain=/);}
  assert.ok(cookies.some(c=>c.startsWith("__Host-hustle_prod_at=")));
  assert.ok(cookies.some(c=>c.startsWith("__Host-hustle_prod_rt=")));
 });
});
test("Unverified email signup does not fake session or account creation",async()=>{
 await mock(async()=>json({user:{id:"unverified"},session:null}),async()=>{
  const r=await worker.fetch(req("/api/preview/auth/sign-up","POST",{
   email:"test@example.com",password:"valid-password-1234"}),env);
  assert.deepEqual(await r.json(),{ok:true,requiresEmailVerification:true});
  assert.equal(r.headers.getSetCookie().length,0);
 });
});
test("Production auth validates session with provider and forwards real JWT only to AWS",async()=>{
 const seen=[];
 await mock(async(url,init)=>{
  seen.push({url,init});
  if(url===sb+"/auth/v1/user")return json(user);
  if(url===aws+"/api/v1/auth/username-availability?username=xpenhimself")return json({username:"xpenhimself",available:true});
  if(url===aws+"/api/v1/auth/me")return json({id:"one",displayName:"Test"});
  throw Error("Unexpected remote: "+url);
 },async()=>{
  const status=await worker.fetch(req("/api/preview/auth/session","GET",undefined,{cookie:sessionCookie()}),env);
  assert.deepEqual(await status.json(),{authenticated:true,user});
  const name=await worker.fetch(req("/api/preview/account/username?username=xpenhimself","GET",undefined,{cookie:sessionCookie()}),env);
  assert.equal((await name.json()).available,true);
  const awsCall=seen.find(x=>x.url.includes("username-availability"));
  assert.equal(awsCall.init.headers.authorization,"Bearer "+access);
  assert.equal(seen.filter(x=>x.url.startsWith(aws)).length,1);
  const res=await worker.fetch(req("/api/preview/account","GET",undefined,{cookie:sessionCookie()}),env);
  assert.equal((await res.json()).displayName,"Test");
 });
});
test("Session refresh preserves server-side tokens and rotates HttpOnly cookies",async()=>{
 let n=0;
 await mock(async(url,init)=>{
  if(url===sb+"/auth/v1/user"){
   n++;return n===1?json({},401):json(user);
  }
  if(url===sb+"/auth/v1/token?grant_type=refresh_token")return json({access_token:access+"x",refresh_token:refresh+"x",expires_in:1800});
  throw Error("Unexpected request: "+url);
 },async()=>{
  const r=await worker.fetch(req("/api/preview/auth/session","GET",undefined,{cookie:sessionCookie()}),env);
  assert.equal((await r.json()).authenticated,true);
  assert.equal(r.headers.getSetCookie().length,2);
 });
});
test("No production identity is claimed without valid session; log out clears both cookies",async()=>{
 const r=await worker.fetch(req("/api/preview/auth/session"),env);
 assert.deepEqual(await r.json(),{authenticated:false,user:null});
 assert.equal((await worker.fetch(req("/api/preview/account"),env)).status,401);
 const out=await worker.fetch(req("/api/preview/auth/sign-out","POST",{}),env);
 assert.equal(out.status,200);assert.equal(out.headers.getSetCookie().length,2);
 assert.ok(out.headers.getSetCookie().every(c=>c.includes("Max-Age=0")));
});
test("No Vercel production fallback or sensitive provider tokens in frontend storage",()=>{
 const src=readFileSync(new URL("../production-gateway.mjs",import.meta.url),"utf8");
 const preview=readFileSync(new URL("../worker.mjs",import.meta.url),"utf8");
 const auth=readFileSync(new URL("../dist/hustle-auth.js",import.meta.url),"utf8");
 assert.match(preview,/handleProductionApi\(req,env\)/);
 assert.match(src,/pfgarmyygybmhiiuopym\.supabase\.co/);
 assert.match(src,/hustle-economy-of-you\.realxpens\.workers\.dev/);
 assert.doesNotMatch(src,/vercel\.app|hustle-staging|service_role/i);
 assert.doesNotMatch(auth,/localStorage|document\.cookie/);
 assert.match(src,/__Host-hustle_prod_at/);
 assert.match(src,/__Host-hustle_prod_rt/);
});
