#!/usr/bin/env node
"use strict";
/** Test the ACTUAL Vercel TypeScript handler without external DB/HTTP access. */
const assert=require("node:assert/strict");
const {readFileSync}=require("node:fs");
const {resolve}=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const root=resolve(__dirname,"../..");
const config=JSON.parse(readFileSync(resolve(root,"apps/api/vercel.json"),"utf8"));
const routes=new Map(config.rewrites.map(x=>[x.source,x.destination]));
assert.equal(routes.get("/api/auth"),"/api?__hustle_auth_path=");
assert.equal(routes.get("/api/auth/:path*"),"/api?__hustle_auth_path=:path*");
assert.equal(routes.get("/api/v1/:path*"),"/api?__hustle_path=:path*");
assert.equal(config.git.deploymentEnabled,false);
const oldTs=Module._extensions[".ts"],oldLoad=Module._load;
let currentScope="isolated-staging",guardCalls=0,nestCreates=0,authStarts=0,apiRequests=[];
const fakeNestHandler=(req,res)=>{apiRequests.push(req.url);return res.status(200).json({via:"nest",url:req.url});};
const fakeApp={
  setGlobalPrefix(v){assert.equal(v,"api/v1");},
  enableCors(){},useGlobalFilters(){},async init(){},
  getHttpAdapter(){return {getInstance:()=>fakeNestHandler};}
};
const stub=new Map([
  ["@nestjs/core",{NestFactory:{create:async()=>{nestCreates++;return fakeApp;}}}],
  ["../src/app.module",{AppModule:class AppModule{}}],
  ["../src/common/filters/all-exceptions.filter",{AllExceptionsFilter:class{}}],
  ["../src/auth/staging-auth-selection",{validateApiRuntimeEnvironment:()=>{
    guardCalls++;return currentScope;
  }}],
  ["../src/auth/expo-staging-auth.service",{getExpoStagingAuth:()=>{authStarts++;return {};}}],
  ["better-auth/node",{toNodeHandler:()=> (req,res)=>
    res.status(200).json({via:"expo-better-auth",url:req.url})}],
  ["reflect-metadata",{}]
]);
Module._load=function(spec,parent,isMain){
  if(stub.has(spec))return stub.get(spec);
  return oldLoad.apply(this,arguments);
};
Module._extensions[".ts"]=(mod,filename)=>{
  const source=readFileSync(filename,"utf8");
  const result=ts.transpileModule(source,{compilerOptions:{
    target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,
    esModuleInterop:true,experimentalDecorators:true
  }});
  mod._compile(result.outputText,filename);
};
function request(query,method="GET"){return {query,url:"/api",method};}
function response(){
  return {code:null,payload:null,headersSent:false,
    status(v){this.code=v;return this;},
    json(v){this.payload=v;return this;}
  };
}
(async()=>{
  const h=require(resolve(root,"apps/api/api/index.ts")).default;
  assert.equal(typeof h,"function");
  const a=response();
  await h(request({__hustle_auth_path:"sign-in/email",next:"ok"},"POST"),a);
  assert.equal(a.code,200);
  assert.deepEqual(a.payload,{via:"expo-better-auth",url:"/api/auth/sign-in/email?next=ok"});
  assert.equal(nestCreates,0,"Better Auth route must never trigger Nest's body parser");
  assert.equal(authStarts,1);
  assert.equal(guardCalls,1);
  console.log("PASS: Vercel /api/auth/* rewrite invokes protected Expo handler before Nest");

  currentScope="production";
  const p=response();
  await h(request({__hustle_auth_path:"sign-up/email"}),p);
  assert.equal(p.code,404);
  assert.equal(authStarts,1);
  currentScope="isolated-staging";
  console.log("PASS: production scope cannot expose staging /api/auth");

  for (const path of ["bookings","payments","media/upload","orders","admin/operations/cases","new-feature"]) {
    const denied=response();
    await h(request({__hustle_path:path},"POST"),denied);
    assert.equal(denied.code,403,path);
    assert.equal(denied.payload.error.code,"STAGING_ROUTE_DISABLED");
  }
  const deniedAuth=response();
  await h(request({__hustle_auth_path:"delete-user"},"POST"),deniedAuth);
  assert.equal(deniedAuth.code,403);
  assert.equal(nestCreates,0,"Disabled routes never initialize application or database");
  assert.equal(authStarts,1,"Disabled routes never invoke Better Auth");
  const {stagingRequestGate}=require(resolve(root,"apps/api/src/staging-request-policy.ts"));
  let passed=false;
  const deniedStandalone=response();
  stagingRequestGate({method:"POST",url:"/api/v1/bookings?ignored=true"},deniedStandalone,()=>{passed=true;});
  assert.equal(deniedStandalone.code,403);
  assert.equal(passed,false);
  stagingRequestGate({method:"POST",url:"/api/v1/auth/sync"},response(),()=>{passed=true;});
  assert.equal(passed,true);
  console.log("PASS: hosted and standalone gates deny commerce, uploads and unknown mutations before handlers");

  const nest=response();
  await h(request({__hustle_path:"search/services",q:"tailoring"}),nest);
  assert.equal(nest.code,200);
  assert.equal(nest.payload.via,"nest");
  assert.equal(nest.payload.url,"/api/v1/search/services?q=tailoring");
  assert.equal(nestCreates,1);
  assert.ok(guardCalls>=3);
  assert.equal(authStarts,1,"App endpoints do not create new login handler");
  console.log("PASS: real Vercel handler rewrites connected API routes and checks runtime before Nest");
  console.log("BOUNDARY: no live network, DB, production deploy, or secret used.");
})().catch(e=>{console.error("FAIL: "+e.message);process.exitCode=1;}).finally(()=>{
  Module._load=oldLoad;
  if(oldTs)Module._extensions[".ts"]=oldTs;else delete Module._extensions[".ts"];
});
