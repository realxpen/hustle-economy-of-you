#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(p){
  const file=path.join(root,p); const mod=new Module(file,module);
  mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
  mod._compile(ts.transpileModule(get(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
  return mod.exports;
}
const api=load("apps/api/src/staging-request-policy.ts");
const proxy=load("apps/web/lib/api/isolated-web-proxy.ts");
const evidence=load("apps/api/src/hustler-application/staging-portfolio-proof.ts");
const original=process.env.HUSTLE_RUNTIME_SCOPE;
try {
 process.env.HUSTLE_RUNTIME_SCOPE="production";
 assert.equal(evidence.hasIsolatedStagingPortfolioEvidence("https://portfolio.example/work"),false);
 process.env.HUSTLE_RUNTIME_SCOPE="isolated-staging";
 for(const url of ["https://portfolio.example/work","https://www.example.org/portfolio"]){
   assert.equal(evidence.hasIsolatedStagingPortfolioEvidence(url),true,url);
 }
 for(const url of ["http://portfolio.example","https://localhost","https://127.0.0.1","https://user:pass@example.org",
  "https://a.internal","https://a.local","file:///tmp/a","https://example.com:8443","https://example.com/#f","some notes"]){
   assert.equal(evidence.hasIsolatedStagingPortfolioEvidence(url),false,url);
 }
 const allowed=[
  ["GET","hustler-application"],["PUT","hustler-application"],["POST","hustler-application/submit"],
  ["GET","hustler-reviews"],["GET","hustler-reviews/abc"],["POST","hustler-reviews/abc/start"],
  ["POST","hustler-reviews/abc/verification"],["POST","hustler-reviews/abc/approve"],
  ["POST","hustler-reviews/abc/reject"],["GET","professional-profile"],["PUT","professional-profile"],
  ["POST","professional-profile/publish"],["POST","professional-profile/unpublish"],
  ["GET","profiles/username"],["GET","storefronts/username"],["GET","services/mine"],["GET","services/mine/abc"],
  ["POST","services"],["PUT","services/abc"],["POST","services/abc/publish"],
  ["POST","services/abc/pause"],["PATCH","auth/profile"],
  ["GET","guest/feed/for-you"],["GET","guest/feed/nearby"],["GET","guest/search"],
  ["GET","guest/search/people"],["GET","guest/marketplace"],["GET","guest/marketplace/services"],
  ["GET","posts/mine"],["GET","posts/mine/abc"],["GET","posts/abc/interactions/me"],
  ["POST","posts"],["PUT","posts/abc"],["POST","posts/abc/media"],["POST","posts/abc/publish"],
  ["POST","posts/abc/archive"],["POST","posts/abc/services/def"],["POST","posts/abc/products/def"],
  ["DELETE","posts/abc/media/def"],["DELETE","posts/abc/services/def"],
  ["DELETE","posts/abc/products/def"],["POST","posts/abc/like"],["DELETE","posts/abc/like"],
  ["POST","posts/abc/save"],["DELETE","posts/abc/save"],["POST","posts/abc/share"],
  ["POST","posts/abc/comments"],["DELETE","posts/abc/comments/def"],
  ["POST","users/abc/follow"],["DELETE","users/abc/follow"],
  ["POST","feed/events"],["POST","search/events"],["POST","marketplace/events"],
  ["GET","wallet"],["GET","wallet/transactions"],["GET","wallet/reconciliation"],
  ["GET","wallet/withdrawals"],["GET","wallet/refunds"],
  ["GET","wallet/release-state/BOOKING/b1"],
  ["GET","payments/p1"],["GET","payments/subjects/BOOKING/b1/latest"],
  ["POST","sandbox/bookings/b1/fund"],["POST","sandbox/bookings/b1/start"],
  ["POST","sandbox/bookings/b1/complete"],["POST","sandbox/bookings/b1/release"],
  ["POST","sandbox/wallet/withdrawals"],
  ["GET","bookings/client"],["GET","bookings/hustler"],["GET","bookings/booking1"],
  ["GET","bookings/availability"],["GET","bookings/slots"],["GET","bookings/duration-insights"],
  ["GET","guest/bookings/availability"],["GET","guest/bookings/slots"],
  ["POST","bookings"],["POST","bookings/booking1/accept"],
  ["POST","bookings/booking1/decline"],["POST","bookings/booking1/cancel"],
  ["GET","messaging/conversations"],["GET","messaging/conversations/c1"],
  ["GET","messaging/conversations/c1/messages"],["GET","messaging/conversations/c1/typing"],
  ["POST","messaging/conversations/direct"],["POST","messaging/conversations/c1/messages"],
  ["POST","messaging/conversations/c1/read"],["POST","messaging/conversations/c1/typing"],
  ["POST","messaging/conversations/c1/messages/m1/context-opened"],
  ["GET","trust-safety/blocks/status/u1"],["POST","trust-safety/blocks/u1"],
  ["DELETE","trust-safety/blocks/u1"],["POST","trust-safety/reports"]
 ];
 for(const [method,route] of allowed) {
   const path="api/v1/"+route;
   assert.equal(proxy.stagingProxyAllowed(method,path.split("/")),true,method+" "+route);
   assert.equal(api.stagingRequestAllowed(method,"/"+path),true,method+" "+route);
 }
 const denied=[
  ["POST","hustler-application/proofs"],["POST","hustler-reviews/abc/proofs/def/read-url"],
  ["POST","posts/abc/upload"],["POST","posts/abc/proofs/def"],["DELETE","services/abc"],["GET","admin/operations/users"],
  ["POST","guest/feed/for-you"],["POST","guest/search"],["POST","guest/marketplace"],
  ["POST","messaging/conversations/c1/attachments"],["DELETE","messaging/conversations/c1"],
  ["GET","trust-safety/reports"],["DELETE","trust-safety/reports/u1"],
  ["POST","bookings/booking1/complete"],["POST","bookings/booking1/start"],
  ["POST","bookings/booking1/extend"],["POST","bookings/booking1/fund"],
  ["POST","guest/bookings/availability"],["POST","guest/bookings/slots"],
  ["DELETE","bookings/booking1"],["POST","payments"],["POST","escrow/release"],
  ["POST","orders"],["POST","wallet/deposit"],["POST","wallet/withdrawals"],
  ["POST","payments/initialize"],["POST","payments/webhooks/sandbox"],
  ["POST","wallet/escrows/bookings/b1/release"],["POST","sandbox/wallet/deposit"],
  ["PATCH","services/abc"],
  ["PUT","hustler-reviews/abc/approve"],["POST","services/abc/delete"]
 ];
 for(const [method,route] of denied) {
  const path="api/v1/"+route;
  assert.equal(proxy.stagingProxyAllowed(method,path.split("/")),false,method+" "+route);
  assert.equal(api.stagingRequestAllowed(method,"/"+path),false,method+" "+route);
 }
 // Route handlers must export every method allowed by the proxy and API.
 // Otherwise Next.js returns 405 before the profile/draft request is proxied.
 const handler = get("apps/web/app/api/isolated/[...path]/route.ts");
 for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
   const signature = "export async function " + method + "(req: NextRequest, context: Context) {";
   assert(handler.includes(signature), method + " handler must be exported to avoid 405");
   const implementation = handler.split(signature)[1]?.split("\n}")[0] ?? "";
   assert(implementation.includes("return proxyIsolatedRequest(req, path);"),
     method + " must pass through staging policy and authenticated proxy");
 }
 assert(!handler.includes("export async function OPTIONS("),
   "Do not expose unrelated method handlers");
 const postClient = get("apps/web/lib/post.ts");
 assert(postClient.includes('if (isolatedWebMode) return sharedAuthenticatedFetch(path, init);'),
   "Post editor must use the staging Better Auth authenticated client");
 assert(postClient.includes('sharedAuthenticatedFetch(\`/posts/'),
   "Public post and post interactions must use the staging same-origin proxy");
 assert.match(get("apps/web/lib/messaging.ts"),/if \(isolatedWebMode\) throw new Error\("Private file attachments/);
 assert.match(get("apps/web/app/messages/start/page.tsx"),/openDirectConversation\(userId\)/);
 assert.match(get("apps/web/app/messages/[conversationId]/page.tsx"),/sendMessage\(conversationId/);
 assert.match(get("apps/web/lib/trust-safety.ts"),/if \(isolatedWebMode\) return sharedAuthenticatedFetch\(path, init\)/);
 const bookingClient=get("apps/web/app/bookings/new/[serviceId]/page.tsx");
 assert.match(bookingClient,/hasViewerSession\(\)/,"staging must use Better Auth session rather than Supabase");
 assert.doesNotMatch(bookingClient,/getSupabaseBrowserClient/);
 assert.match(get("apps/api/src/booking/booking.service.ts"),/HUSTLE_RUNTIME_SCOPE === "isolated-staging"/);
 assert.match(get("apps/api/src/booking/booking.service.ts"),/MessageContextType\.SERVICE/);
 assert.match(get("apps/web/app/bookings/[bookingId]/page.tsx"),/proposeAlternateTime/);
 assert.match(get("apps/web/app/bookings/[bookingId]/page.tsx"),/!isolatedWebMode && booking\.viewerRole/);
 assert.match(get("apps/web/app/services/[serviceId]/page.tsx"),/Request a time \(test\)/);
 const postApi = get("apps/api/src/post/post.service.ts");
 assert(postApi.includes('this.isPublicStagingMediaUrl(mediaUrl)'),
   "Only externally hosted HTTPS media may be attached to staging posts");
 const profileClient = get("apps/web/lib/auth/hustle-account.ts");
 assert(profileClient.includes('authenticatedFetch("/auth/profile", { method: "PATCH"'),
   "Profile onboarding must use the allowed PATCH path");
 for(const p of ["hustler-application","hustler-review","professional-profile","service"]){
  assert.match(get("apps/web/lib/"+p+".ts"),/import \{ authenticatedFetch \} from "\.\/api\/authenticated-fetch";/);
 }
 assert.match(get("apps/web/lib/storefront.ts"),/publicReadFetch/);
 assert.match(get("apps/web/lib/post.ts"),/publicReadFetch/);
 assert.match(get("apps/web/lib/feed.ts"),/guest/);
 assert.match(get("apps/web/lib/search.ts"),/guest/);
 assert.match(get("apps/web/app/home/page.tsx"),/redirectGuestToAuth/);
 assert.match(get("apps/web/app/auth/staging-sign-in.tsx"),/safeAuthReturnPath/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.controller.ts"),/@UseGuards\(AuthGuard, AdminGuard\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.service.ts"),/assertNotSelfReview\(application.userId, reviewer.id\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.service.ts"),/identityVerificationStatus !== VerificationStatus.VERIFIED/);
 assert.match(get("apps/api/src/professional-profile/professional-profile.controller.ts"),/@RequireCapability\(Capability.HUSTLER\)/);
 assert.match(get("apps/api/src/service/service.controller.ts"),/@RequireCapability\(Capability.HUSTLER\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-application.service.ts"),/hasIsolatedStagingPortfolioEvidence\(application.businessInfo\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.service.ts"),/hasIsolatedStagingPortfolioEvidence\(application.businessInfo\)/);
 const s=get("apps/web/app/search/page.tsx");
 assert.match(s,/className=\{query.trim\(\).toLowerCase\(\) === term \? styles.selectedSkill/);
 assert.match(s,/activeFilterCount>0 && <button type="button" className=\{styles\.resetButton\}/);
 assert.match(s,/setFilters\(emptyFilters\);void runSearch\(tab,null,false,emptyFilters\)/);
 console.log("PASS: isolated staging onboarding, approval and service publishing routes, production proof isolation, role boundaries and search UX.");
}finally{if(original===undefined)delete process.env.HUSTLE_RUNTIME_SCOPE;else process.env.HUSTLE_RUNTIME_SCOPE=original;}
