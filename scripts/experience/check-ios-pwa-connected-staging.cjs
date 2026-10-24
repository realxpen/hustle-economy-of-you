#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const get = p => fs.readFileSync(path.join(root,p), "utf8");
function load(p,mocks={}) {
 const file=path.join(root,p);
 const js=ts.transpileModule(get(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,
   target:ts.ScriptTarget.ES2022}}).outputText;
 const mod=new Module(file,module);
 mod.filename=file; mod.paths=Module._nodeModulePaths(path.dirname(file));
 const defaultRequire=mod.require.bind(mod);
 mod.require=k=>Object.hasOwn(mocks,k)?mocks[k]:defaultRequire(k);
 mod._compile(js,file); return mod.exports;
}
const proxy=load("apps/web/lib/api/isolated-web-proxy.ts");
const original=Object.fromEntries(["HUSTLE_ISOLATED_PWA_GATE","NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH"].map(k=>[k,process.env[k]]));
async function go(){
 try{
  delete process.env.HUSTLE_ISOLATED_PWA_GATE;
  process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="true";
  assert.equal(proxy.isIsolatedWebPreviewEnabled(),false);
  process.env.HUSTLE_ISOLATED_PWA_GATE="isolated-staging";
  process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="false";
  assert.equal(proxy.isIsolatedWebPreviewEnabled(),false);
  process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="true";
  assert.equal(proxy.isIsolatedWebPreviewEnabled(),true);
  for(const ep of ["auth/get-session","auth/ok","api/v1/feed/for-you",
    "api/v1/feed/nearby","api/v1/feed/connections","api/v1/search",
    "api/v1/search/people","api/v1/search/posts","api/v1/auth/me",
    "api/v1/health"]) assert.equal(proxy.stagingProxyAllowed("GET",ep.split("/")),true,ep);
  for(const ep of ["auth/sign-in/email","auth/sign-up/email","auth/sign-out","api/v1/auth/sync"])
    assert.equal(proxy.stagingProxyAllowed("POST",ep.split("/")),true,ep);
  for(const ep of ["api/v1/payments","api/v1/booking","api/v1/escrow",
    "api/v1/posts/p1/upload","api/v1/messaging/conversations/direct",
    "api/v1/admin","auth/forgot-password","auth/revoke-sessions",
    "https:","api/v1/search/../payments"]) {
    for(const method of ["GET","POST","DELETE","PUT","PATCH"])
      assert.equal(proxy.stagingProxyAllowed(method,ep.split("/")),false,method+" "+ep);
  }
  assert.equal(proxy.stagingProxyAllowed("POST",["api","v1","feed","for-you"]),false);
  assert.equal(proxy.stagingProxyAllowed("POST",["api","v1","posts"]),true);
  assert.equal(proxy.stagingProxyAllowed("POST",["api","v1","posts","p1","publish"]),true);
  assert.equal(proxy.stagingProxyAllowed("DELETE",["api","v1","posts","p1","media","m1"]),true);
  assert.equal(proxy.stagingProxyAllowed("POST",["api","v1","posts","p1","upload"]),false);
  assert.equal(proxy.stagingProxyAllowed("GET",["api","v1","posts"]),true);
  for (const route of ["guest/feed/for-you", "guest/feed/nearby", "guest/search",
    "guest/search/people", "guest/marketplace", "guest/marketplace/services"]) {
    const segments=("api/v1/"+route).split("/");
    assert.equal(proxy.stagingProxyAllowed("GET",segments),true,"public read "+route);
    for(const method of ["POST","PUT","PATCH","DELETE"])
      assert.equal(proxy.stagingProxyAllowed(method,segments),false,"public write denied "+route);
  }
  const fake={method:"POST",headers:new Headers({"origin":"https://malicious.example",
    "content-type":"application/json"}),nextUrl:new URL("https://pwa.example/api/isolated/auth/sign-in/email")};
  const response=await proxy.proxyIsolatedRequest(fake,["auth","sign-in","email"]);
  assert.equal(response.status,403,"cross-origin write must stop before network calls");
  const noJSON={...fake,headers:new Headers({"origin":"https://pwa.example",
    "content-type":"application/x-www-form-urlencoded"})};
  const rejected=await proxy.proxyIsolatedRequest(noJSON,["auth","sign-in","email"]);
  assert.equal(rejected.status,403,"CSRF form writes must not reach staging API");
  const client=get("apps/web/lib/api/authenticated-fetch.ts");
  assert.match(client,/isolatedWebMode \? "\/api\/isolated\/api\/v1"/);
  assert.match(client,/stagingSession\(\)/);
  assert.match(client,/credentials: isolatedWebMode \? "same-origin"/);
  const bridge=get("apps/web/lib/auth/isolated-web-auth.ts");
  assert.match(bridge,/credentials:"same-origin"/);
  assert.match(bridge,/minLength\={12}|password\.length < 12/);
  assert.doesNotMatch(bridge,/localStorage|sessionStorage/);
  const auth=get("apps/web/app/auth/page.tsx");
  assert.match(auth,/isolatedWebMode \? <StagingWebSignIn\/> : <SupabaseAuthPage\/>/);
  const signIn=get("apps/web/app/auth/staging-sign-in.tsx");
  assert.match(signIn,/await syncHustleAccount\(\)/);
  const account=get("apps/web/app/account/page.tsx");
  assert.match(account,/stageSignOut\(\)/);
  const css=get("apps/web/app/home/page.module.css");
  assert.match(css,/Observ(ed|ed) iPhone Safari/);
  assert.match(css,/\.playerColumn > :global\(\[role="alert"\]\)/);
  console.log("PASS: 55+ isolated PWA route, auth, session, CSRF, non-financial and iPhone error layout assertions.");
 }finally{
  for(const [k,v] of Object.entries(original))if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
}
go().catch(e=>{console.error(e);process.exitCode=1});
