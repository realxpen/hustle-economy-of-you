#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(p){
  const name=path.join(root,p),mod=new Module(name,module);
  mod.filename=name;mod.paths=Module._nodeModulePaths(path.dirname(name));
  mod._compile(ts.transpileModule(get(p),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
  }}).outputText,name);
  return mod.exports;
}
const api=load("apps/api/src/staging-request-policy.ts");
const web=load("apps/web/lib/api/isolated-web-proxy.ts");
const matrix=[
  ["GET","notifications",true],
  ["GET","notifications/unread-count",true],
  ["POST","notifications/read-all",true],
  ["POST","notifications/n1/read",true],
  ["POST","notifications/n1",false],
  ["POST","notifications/n1/delete",false],
  ["GET","notifications/read-all",false],
  ["GET","notifications/n1/read",false],
  ["GET","notifications/n1",false],
  ["PUT","notifications/n1/read",false],
  ["DELETE","notifications/n1",false],
  ["GET","notifications/private/admin",false],
  ["POST","notifications",false],
  ["POST","wallet/refunds",false],
  ["POST","payments/initialize",false]
];
for(const [method,route,expected] of matrix){
  assert.equal(api.stagingRequestAllowed(method,"/api/v1/"+route),expected,"API "+method+" "+route);
  assert.equal(web.stagingProxyAllowed(method,("api/v1/"+route).split("/")),expected,"PWA "+method+" "+route);
}
const controller=get("apps/api/src/notifications/notifications.controller.ts");
assert.match(controller,/@UseGuards\(AuthGuard\)/);
const service=get("apps/api/src/notifications/notifications.service.ts");
assert.match(service,/WHERE n\."recipientUserId" = \$\{recipientUserId\}/);
assert.match(service,/recipientUserId,\s*readAt: null/);
assert.match(service,/recipientUserId: review.revieweeUserId/);
assert.match(service,/eventKey: .review:verified:/);
const client=get("apps/web/lib/notifications.ts");
assert.match(client,/authenticatedFetch\("\/notifications\/unread-count"\)/);
assert.match(client,/authenticatedFetch\("\/notifications\/read-all", \{\s*method: "POST"/);
const dock=get("apps/web/components/navigation/hustle-mobile-nav.tsx");
assert.match(dock,/unreadOnYou/);
assert.match(dock,/appBadge/);
assert.match(dock,/mobileAppItems/);
const screen=get("apps/web/app/notifications/page.tsx");
assert.match(screen,/router.push\(allowedHref\(item.href\)\)/);
assert.doesNotMatch(screen,/router.replace\("\/auth"\)/);
assert.match(screen,/readAllNotifications\(\)/);
assert.match(screen,/getUnreadNotificationCount\(\)/);
assert.match(screen,/bookings\|messages\|posts\|orders/);
assert.match(get("apps/web/app/bookings/[bookingId]/page.tsx"),/View your public reviews/);

async function verifyBridge(){
  const oldFetch=global.fetch, oldGate=process.env.HUSTLE_ISOLATED_PWA_GATE;
  const oldAuth=process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH;
  try{
    process.env.HUSTLE_ISOLATED_PWA_GATE="isolated-staging";
    process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="true";
    const calls=[];
    global.fetch=async (url, init)=>{
      calls.push({url:String(url),method:init.method,token:init.headers.get("authorization"),body:init.body});
      return new Response(JSON.stringify({items:[],count:2,read:true,updatedCount:2}),{
        status:200,headers:{"content-type":"application/json"}
      });
    };
    const segments=p=>("api/v1/"+p).split("/");
    const req=(method,origin="https://hustle.test")=>({
      method,
      nextUrl:{origin:"https://hustle.test",searchParams:new URLSearchParams({cursor:"abc",limit:"20",account:"cross-user"})},
      headers:new Headers({origin,"content-type":"application/json",authorization:"Bearer isolated-test"}),
      text:async()=> "{}"
    });
    assert.equal((await web.proxyIsolatedRequest(req("GET"),segments("notifications"))).status,200);
    assert.match(calls[0].url,/notifications\?cursor=abc&limit=20/);
    assert.doesNotMatch(calls[0].url,/account=/);
    assert.equal(calls[0].token,"Bearer isolated-test");
    assert.equal((await web.proxyIsolatedRequest(req("GET"),segments("notifications/unread-count"))).status,200);
    assert.equal((await web.proxyIsolatedRequest(req("POST"),segments("notifications/n1/read"))).status,200);
    assert.equal(calls[2].method,"POST");
    assert.equal((await web.proxyIsolatedRequest(req("POST"),segments("notifications/read-all"))).status,200);
    assert.equal((await web.proxyIsolatedRequest(req("POST","https://attacker.test"),segments("notifications/read-all"))).status,403);
    assert.equal((await web.proxyIsolatedRequest(req("DELETE"),segments("notifications/n1"))).status,403);
    assert.equal(calls.length,4,"rejected writes must not reach API");
  }finally{
    global.fetch=oldFetch;
    if(oldGate===undefined)delete process.env.HUSTLE_ISOLATED_PWA_GATE;
    else process.env.HUSTLE_ISOLATED_PWA_GATE=oldGate;
    if(oldAuth===undefined)delete process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH;
    else process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=oldAuth;
  }
}
verifyBridge().then(()=>console.log("PASS: UX007 isolated Activity route parity, 3G-safe navigation, recipient-scope contracts and iPhone CSRF/pagination bridge")).catch(e=>{console.error(e);process.exitCode=1});
