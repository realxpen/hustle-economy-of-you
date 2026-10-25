#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(p){
  const location=path.join(root,p),mod=new Module(location,module);
  mod.filename=location;mod.paths=Module._nodeModulePaths(path.dirname(location));
  mod._compile(ts.transpileModule(get(p),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
  }}).outputText,location);
  return mod.exports;
}
const api=load("apps/api/src/staging-request-policy.ts");
const web=load("apps/web/lib/api/isolated-web-proxy.ts");
const allowed=[
 ["GET","wallet"],["GET","wallet/transactions"],["GET","wallet/reconciliation"],
 ["GET","wallet/refunds"],["GET","wallet/withdrawals"],
 ["GET","wallet/release-state/BOOKING/b1"],["GET","payments/subjects/BOOKING/b1/latest"],
 ["POST","sandbox/bookings/b1/fund"],["POST","sandbox/bookings/b1/start"],
 ["POST","sandbox/bookings/b1/complete"],["POST","sandbox/bookings/b1/release"],
 ["POST","sandbox/wallet/withdrawals"]
];
const blocked=[
 ["POST","wallet/withdrawals"],["POST","wallet/refunds"],["POST","payments/initialize"],
 ["POST","wallet/escrows/bookings/b1/release"],["POST","payments/webhooks/sandbox"],
 ["POST","sandbox/wallet/deposit"],["POST","sandbox/bookings/b1/refund"],
 ["GET","sandbox/wallet/withdrawals"],["DELETE","sandbox/bookings/b1/fund"]
];
for(const [method,route] of allowed.concat(blocked)){
  const expected=allowed.some(x=>x[0]===method&&x[1]===route);
  assert.equal(api.stagingRequestAllowed(method,"/api/v1/"+route),expected,method+" server "+route);
  assert.equal(web.stagingProxyAllowed(method,("api/v1/"+route).split("/")),expected,method+" proxy "+route);
}
const guard=load("apps/api/src/payment/isolated-sandbox-finance.guard.ts");
const keys=["HUSTLE_RUNTIME_SCOPE","HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED",
  "HUSTLE_FINANCIAL_PROVIDERS_ENABLED","DATABASE_URL",
  "HUSTLE_STAGING_PROJECT_ID","HUSTLE_STAGING_BRANCH_ID","HUSTLE_SANDBOX_WEBHOOK_SECRET"];
const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
function rejected(){assert.throws(()=>guard.assertIsolatedSandboxFinance())}
try{
  process.env.HUSTLE_RUNTIME_SCOPE="production";
  process.env.HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED="true";
  process.env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED="false";
  process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET="a".repeat(64);
  process.env.DATABASE_URL="postgresql://test:test@127.0.0.1:55439/hustle_payment_sandbox";
  rejected();
  process.env.HUSTLE_RUNTIME_SCOPE="isolated-staging";
  process.env.HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED="false";rejected();
  process.env.HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED="true";
  process.env.DATABASE_URL="postgresql://user:pass@prod.example/hustle_main";rejected();
  process.env.DATABASE_URL="postgresql://test:test@127.0.0.1:55439/hustle_payment_sandbox";
  if(process.env.NODE_ENV==="test")assert.ok(guard.assertIsolatedSandboxFinance());
  else rejected();
}finally{
  for(const k of keys){
    if(original[k]===undefined)delete process.env[k];
    else process.env[k]=original[k];
  }
}
assert.match(get("apps/api/src/feed/feed.service.ts"),/commentedIds\.has/);
assert.match(get("apps/api/src/post/post-interaction.service.ts"),/commented: Boolean\(comment\)/);
assert.match(get("apps/web/app/home/page.tsx"),/styles\.commentedAction/);
assert.match(get("apps/web/app/posts/[postId]/page.tsx"),/styles\.ownComment/);
assert.match(get("apps/web/app/posts/[postId]/page.module.css"),/\.ownComment\{/);
assert.match(get("apps/web/app/home/page.module.css"),/\.postCanvas\{inset:0!important/);
assert.match(get("apps/web/app/wallet/page.tsx"),/HUSTLE SANDBOX/);
assert.match(get("apps/web/app/wallet/page.tsx"),/SIMULATION ONLY/);

const releaseUi = get("apps/web/components/finance/sandbox-booking-actions.tsx");
// UX005 regression: COMPLETED describes work only; it must never be used alone
// to offer another escrow release. The authenticated ledger read is authoritative.
assert.match(releaseUi, /getReleaseState\("BOOKING", bookingId\)/);
assert.match(releaseUi, /currentRelease\.value\?\.status === "HELD" && currentRelease\.value\.released === false/);
assert.match(releaseUi, /booking\.status === "COMPLETED" && canRelease/);
assert.match(releaseUi, /Retry escrow status/);
assert.match(releaseUi, /released: true, status: "RELEASED"/);
assert.doesNotMatch(releaseUi, /booking\.status === "COMPLETED" \? "release"/);

assert.match(get("apps/web/lib/finance.ts"),/commonAuthenticatedFetch\(path, init\)/);
assert.match(get("apps/api/src/payment/payment.module.ts"),/IsolatedSandboxFinanceController/);
// Exercise the real PWA proxy, not just its path allowlist: financial idempotency
// must survive the iPhone -> Next.js -> isolated API hop.
async function testIdempotencyProxy() {
  const originalFetch=global.fetch;
  const gate=process.env.HUSTLE_ISOLATED_PWA_GATE;
  const auth=process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH;
  let calls=0, forwarded=null;
  try {
    process.env.HUSTLE_ISOLATED_PWA_GATE="isolated-staging";
    process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="true";
    global.fetch=async(_url,init)=>{
      calls++;
      forwarded=init.headers.get("idempotency-key");
      return new Response('{"ok":true}',{status:200,headers:{"content-type":"application/json"}});
    };
    const req=(key)=>({method:"POST",nextUrl:{origin:"https://hustle.test",searchParams:new URLSearchParams()},
      headers:new Headers({origin:"https://hustle.test","content-type":"application/json",
        ...(key===undefined?{}:{"idempotency-key":key})}),
      text:async()=>JSON.stringify({amountMinor:100,currency:"NGN",confirmation:"SIMULATE_TEST_WITHDRAWAL"})});
    const route=["api","v1","sandbox","wallet","withdrawals"];
    const key="withdrawal-retry-123456789";
    assert.equal((await web.proxyIsolatedRequest(req(key),route)).status,200);
    assert.equal(forwarded,key,"proxy must forward original sandbox withdrawal idempotency key");
    assert.equal((await web.proxyIsolatedRequest(req(undefined),route)).status,400,"missing key fails closed");
    assert.equal((await web.proxyIsolatedRequest(req("bad key"),route)).status,400,"invalid key fails closed");
    assert.equal(calls,1,"rejected writes never reach upstream API");
    assert.equal((await web.proxyIsolatedRequest(req(key),["api","v1","posts"])).status,200);
    assert.equal(forwarded,null,"financial idempotency header must not propagate to unrelated writes");
  }finally{
    global.fetch=originalFetch;
    if(gate===undefined)delete process.env.HUSTLE_ISOLATED_PWA_GATE;
    else process.env.HUSTLE_ISOLATED_PWA_GATE=gate;
    if(auth===undefined)delete process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH;
    else process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=auth;
  }
}
testIdempotencyProxy().then(()=>{
  console.log("PASS: UX005 wallet, comments, isolate gate, and iPhone idempotency proxy roundtrip");
}).catch(error=>{console.error(error);process.exitCode=1});
