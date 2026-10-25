#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const get = p => fs.readFileSync(path.join(root, p), "utf8");
function load(p) {
  const filename = path.join(root,p);
  const mod = new Module(filename,module);
  mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod._compile(ts.transpileModule(get(p), {compilerOptions: {
    module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022
  }}).outputText,filename);
  return mod.exports;
}
const api=load("apps/api/src/staging-request-policy.ts");
const proxy=load("apps/web/lib/api/isolated-web-proxy.ts");
const cases=[
  ["GET","reviews/eligibility/BOOKING/booking1",true],
  ["GET","reviews/review1",true],
  ["GET","trust/users/hustler1/summary",true],
  ["POST","reviews",true],
  ["GET","reviews/eligibility/ORDER/order1",false],
  ["GET","reviews/me/given",false],
  ["GET","reviews/users/hustler1/received",false],
  ["POST","reviews/review1",false],
  ["POST","trust/users/hustler1/summary",false],
  ["GET","trust/admin",false],
  ["DELETE","reviews/review1",false],
  ["POST","wallet/refunds",false],
  ["POST","payments/initialize",false]
];
for (const [method,route,allowed] of cases) {
  assert.equal(api.stagingRequestAllowed(method,"/api/v1/"+route),allowed, "Nest "+method+" "+route);
  assert.equal(proxy.stagingProxyAllowed(method,("api/v1/"+route).split("/")),allowed,"PWA "+method+" "+route);
}
const controller=get("apps/api/src/trust/review.controller.ts");
assert.match(controller,/process\.env\.HUSTLE_RUNTIME_SCOPE === "isolated-staging" && input\?\.subjectType !== "BOOKING"/);
const eligibility=get("apps/api/src/trust/review-eligibility.service.ts");
assert.match(eligibility,/BOOKING_ESCROW_NOT_RELEASED/);
const service=get("apps/api/src/trust/review.service.ts");
assert.match(service,/This transaction has already been reviewed/);
assert.match(service,/The Booking escrow must be released before reviews unlock/);
assert.match(service,/Only the Booking Client can publish a provider reputation review/);
const web=get("apps/web/lib/trust.ts");
assert.match(web,/if \(isolatedWebMode\) return commonAuthenticatedFetch\(path, init\)/);
assert.match(web,/\/api\/isolated\/api\/v1\/trust\/users\//);
const booking=get("apps/web/app/bookings/[bookingId]/page.tsx");
assert.match(booking,/booking\.viewerRole === "CLIENT" && booking\.status === "COMPLETED"/);
assert.match(booking,/setReviewRefreshKey\(\(version\) => version \+ 1\)/);
assert.match(booking,/<ReviewEligibilityCard key=/);

const bookingList=get("apps/web/app/bookings/page.tsx");
const mobileNav=get("apps/web/components/navigation/hustle-mobile-nav.tsx");
// iPhone routing regression: "Review service" previously opened the public
// Service screen, not the verified-review form.
assert.match(booking,/id="booking-review"/);
assert.match(booking,/href="#booking-review"/);
assert.match(booking,/>View service details<\/Link>/);
assert.doesNotMatch(booking,/>Review service<\/Link>/);
assert.match(bookingList,/Open booking to leave a verified review/);
// A transient get-session error must not be interpreted as sign-out on 3G.
// The signed-in You route performs its own protected account read.
assert.match(mobileNav,/if \(isolatedWebMode && href === "\/account"\) return/);
assert.match(mobileNav,/\.catch\(\(\) => window\.location\.assign\(href\)\)/);
assert.doesNotMatch(mobileNav,/\.catch\(\(\) => window\.location\.assign\(authUrl\(href\)\)\)/);

const reviewCard=get("apps/web/components/trust/review-eligibility-card.tsx");
assert.match(reviewCard,/HUSTLE SANDBOX · TEST REPUTATION/);
assert.match(reviewCard,/not production reputation/);
const profile=get("apps/web/components/trust/public-reputation-panel.tsx");
assert.match(profile,/not production work/);
const servicePage=get("apps/web/app/services/[serviceId]/page.tsx");
assert.match(servicePage,/getPublicTrustSummary\(ownerId, 3\)/);
assert.match(servicePage,/Staging bookings, escrow and wallet entries are simulated/);
async function proxyTest(){
 const oldFetch=global.fetch;
 const oldGate=process.env.HUSTLE_ISOLATED_PWA_GATE;
 const oldAuth=process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH;
 try {
   process.env.HUSTLE_ISOLATED_PWA_GATE="isolated-staging";
   process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="true";
   const calls=[];
   global.fetch=async(url,init)=>{
     calls.push({url:String(url),method:init.method,authorization:init.headers.get("authorization"),body:init.body});
     return new Response('{"ok":true}',{status:200,headers:{"content-type":"application/json"}});
   };
   const path=p=>("api/v1/"+p).split("/");
   const request=(method,origin,body)=>({
     method, nextUrl:{origin:"https://hustle.test",searchParams:new URLSearchParams()},
     headers:new Headers({"origin":origin, "content-type":"application/json","authorization":"Bearer test-only-placeholder"}),
     text:async()=>body??""
   });
   assert.equal((await proxy.proxyIsolatedRequest(request("GET","https://hustle.test"),path("reviews/eligibility/BOOKING/b1"))).status,200);
   assert.equal(calls[0].authorization,"Bearer test-only-placeholder");
   assert.equal((await proxy.proxyIsolatedRequest(request("GET","https://hustle.test"),path("trust/users/h1/summary"))).status,200);
   assert.equal((await proxy.proxyIsolatedRequest(request("POST","https://malicious.test",'{"subjectType":"BOOKING"}'),path("reviews"))).status,403);
   assert.equal(calls.length,2,"foreign-origin review must not reach API");
   assert.equal((await proxy.proxyIsolatedRequest(request("POST","https://hustle.test",'{"subjectType":"BOOKING","rating":5,"body":"Well done in the sandbox"}'),path("reviews"))).status,200);
   assert.equal(calls[2].method,"POST");
   assert.ok(calls[2].body.includes('"subjectType":"BOOKING"'));
   assert.equal((await proxy.proxyIsolatedRequest(request("POST","https://hustle.test",'{}'),path("payments/initialize"))).status,403);
   assert.equal(calls.length,3);
 } finally {
   global.fetch=oldFetch;
   if(oldGate===undefined)delete process.env.HUSTLE_ISOLATED_PWA_GATE; else process.env.HUSTLE_ISOLATED_PWA_GATE=oldGate;
   if(oldAuth===undefined)delete process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH; else process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=oldAuth;
 }
}
proxyTest().then(()=>console.log("PASS: UX006 verified Booking reputation, route restrictions, iPhone session forwarding, CSRF and staging labels"))
.catch(err=>{console.error(err);process.exitCode=1});
