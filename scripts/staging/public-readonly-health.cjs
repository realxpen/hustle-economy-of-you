#!/usr/bin/env node
"use strict";
/**
 * Safe public staging diagnostics. GET/HEAD only, no signup, no sessions,
 * passwords, cookies, personal records, mutations or payment calls.
 * Never prints HTTP response bodies, request URLs or access tokens.
 */
const assert=require("node:assert/strict");
const {URL}=require("node:url");
const host="https://hustle-isolated-staging-api.vercel.app";
const base=new URL(host);
assert.equal(base.protocol,"https:");
assert.equal(base.hostname,"hustle-isolated-staging-api.vercel.app");
assert.equal(base.username,"");
assert.equal(base.password,"");
if(process.env.HUSTLE_DIAGNOSTIC_TARGET && process.env.HUSTLE_DIAGNOSTIC_TARGET!==host)
  throw Error("Refusing any destination except approved nonproduction API");
for(const name of ["DATABASE_URL","STAGING_AUTH_DATABASE_URL","BETTER_AUTH_SECRET","HUSTLE_STAGING_MIGRATION_URL"]){
  if(process.env[name])throw Error("Public diagnostic must not receive private credentials");
}
const paths=["/api/v1/health","/api/auth/ok","/api/v1/auth/me"];
async function probe(path){
  const address=new URL(path,base);
  assert.equal(address.origin,base.origin);
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),12000);
  try {
    const res=await fetch(address,{
      method:"GET",redirect:"manual",signal:controller.signal,cache:"no-store",
      headers:{accept:"application/json","user-agent":"Hustle-Isolated-Staging-Public-ReadOnly-Diagnostic"}
    });
    const contentType=res.headers.get("content-type")||"unknown";
    const type=/json/i.test(contentType)?"json":/html/i.test(contentType)?"html":"other";
    let errorCode="";
    if(type==="json"){
      try{
        const body=await res.json();
        const candidate=body?.error?.code??body?.code;
        if(typeof candidate==="string"&&/^[A-Za-z0-9_-]{1,60}$/.test(candidate))errorCode=candidate;
      }catch{}
    } else {
      await res.body?.cancel().catch(()=>{});
    }
    return {path,status:res.status,contentType:type,errorCode,redirected:res.status>=300&&res.status<400};
  } finally{clearTimeout(timeout);}
}
(async()=>{
  const results=[];
  for(const path of paths){
    try{
      const x=await probe(path);
      results.push(x);
      console.log("STAGING_GET_STATUS "+JSON.stringify(x));
    }catch(err){
      const code=err?.name==="AbortError"?"TIMEOUT":"NETWORK_OR_TLS_FAILURE";
      results.push({path,status:0,code});
      console.log("STAGING_GET_STATUS "+JSON.stringify({path,status:0,code}));
    }
  }
  const health=results[0],auth=results[1],me=results[2];
  console.log("DIAGNOSTIC_BOUNDS public GET-only, no auth/signup, no personal data or mutation");
  if(health.status!==200 || health.contentType!=="json"){
    console.error("STAGING_DIAGNOSTIC_NOT_READY: health must return public HTTP 200 JSON; review displayed status codes");
    process.exitCode=1;
  } else if(auth.status<200||auth.status>=500||me.status!==401){
    console.error("STAGING_DIAGNOSTIC_INCOMPLETE: hosted anonymous routes need review; no acceptance claim");
    process.exitCode=1;
  } else {
    console.log("PASS: public staging HTTP routes answer, auth endpoints reachable, anonymous account denied");
  }
})().catch(()=>{console.error("STAGING_DIAGNOSTIC_ERROR: private error details suppressed");process.exitCode=1;});
