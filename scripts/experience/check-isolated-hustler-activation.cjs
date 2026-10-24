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
  ["GET","posts/mine"],["GET","posts/mine/abc"],["GET","posts/abc/interactions/me"],
  ["POST","posts"],["PUT","posts/abc"],["POST","posts/abc/media"],["POST","posts/abc/publish"],
  ["POST","posts/abc/archive"],["POST","posts/abc/services/def"],["POST","posts/abc/products/def"],
  ["DELETE","posts/abc/media/def"],["DELETE","posts/abc/services/def"],
  ["DELETE","posts/abc/products/def"],["POST","posts/abc/like"],["DELETE","posts/abc/like"],
  ["POST","posts/abc/save"],["DELETE","posts/abc/save"],["POST","posts/abc/share"],
  ["POST","posts/abc/comments"],["DELETE","posts/abc/comments/def"],
  ["POST","users/abc/follow"],["DELETE","users/abc/follow"],
  ["POST","feed/events"],["POST","search/events"],["POST","marketplace/events"]
 ];
 for(const [method,route] of allowed) {
   const path="api/v1/"+route;
   assert.equal(proxy.stagingProxyAllowed(method,path.split("/")),true,method+" "+route);
   assert.equal(api.stagingRequestAllowed(method,"/"+path),true,method+" "+route);
 }
 const denied=[
  ["POST","hustler-application/proofs"],["POST","hustler-reviews/abc/proofs/def/read-url"],
  ["POST","posts/abc/upload"],["POST","posts/abc/proofs/def"],["DELETE","services/abc"],["GET","admin/operations/users"],
  ["POST","bookings"],["POST","payments"],["POST","escrow/release"],
  ["POST","orders"],["POST","wallet/deposit"],["PATCH","services/abc"],
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
 const postApi = get("apps/api/src/post/post.service.ts");
 assert(postApi.includes('this.isPublicStagingMediaUrl(mediaUrl)'),
   "Only externally hosted HTTPS media may be attached to staging posts");
 const profileClient = get("apps/web/lib/auth/hustle-account.ts");
 assert(profileClient.includes('authenticatedFetch("/auth/profile", { method: "PATCH"'),
   "Profile onboarding must use the allowed PATCH path");
 for(const p of ["hustler-application","hustler-review","professional-profile","service","storefront"]){
  assert.match(get("apps/web/lib/"+p+".ts"),/import \{ authenticatedFetch \} from "\.\/api\/authenticated-fetch";/);
 }
 assert.match(get("apps/api/src/hustler-application/hustler-review.controller.ts"),/@UseGuards\(AuthGuard, AdminGuard\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.service.ts"),/assertNotSelfReview\(application.userId, reviewer.id\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.service.ts"),/identityVerificationStatus !== VerificationStatus.VERIFIED/);
 assert.match(get("apps/api/src/professional-profile/professional-profile.controller.ts"),/@RequireCapability\(Capability.HUSTLER\)/);
 assert.match(get("apps/api/src/service/service.controller.ts"),/@RequireCapability\(Capability.HUSTLER\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-application.service.ts"),/hasIsolatedStagingPortfolioEvidence\(application.businessInfo\)/);
 assert.match(get("apps/api/src/hustler-application/hustler-review.service.ts"),/hasIsolatedStagingPortfolioEvidence\(application.businessInfo\)/);
 const s=get("apps/web/app/search/page.tsx");
 assert.match(s,/className=\{query.trim\(\).toLowerCase\(\) === term \? styles.selectedSkill/);
 assert.match(s,/action=\{activeFilterCount \?/);
 console.log("PASS: isolated staging onboarding, approval and service publishing routes, production proof isolation, role boundaries and search UX.");
}finally{if(original===undefined)delete process.env.HUSTLE_RUNTIME_SCOPE;else process.env.HUSTLE_RUNTIME_SCOPE=original;}
