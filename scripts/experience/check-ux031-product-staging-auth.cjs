#!/usr/bin/env node
"use strict";
// UX031: staging is an isolated disposable environment; unlike Supabase
// production sessions it uses first-party Better Auth session cookies.
// This test deliberately makes NO API requests or changes any live products.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const source=relative=>fs.readFileSync(path.join(root,relative),"utf8");
function load(relative){
  const filename=path.join(root,relative);
  const instance=new Module(filename,module);
  instance.filename=filename;
  instance.paths=Module._nodeModulePaths(path.dirname(filename));
  instance._compile(ts.transpileModule(source(relative),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
  }}).outputText,filename);
  return instance.exports;
}
const product=source("apps/web/lib/product.ts");
const shared=source("apps/web/lib/api/authenticated-fetch.ts");
const editor=source("apps/web/app/products/product-editor.tsx");
const controller=source("apps/api/src/product/product.controller.ts");
const service=source("apps/api/src/product/product.service.ts");
assert.match(product,/import \{ authenticatedFetch \} from "\.\/api\/authenticated-fetch";/);
assert.doesNotMatch(product,/getSupabaseBrowserClient|getSession\(|NEXT_PUBLIC_API_URL|const apiBase/);
for (const [verb,endpoint] of [
 ["GET","/products/mine"],["GET","/products/mine/"],
 ["POST","/products"],["PUT","/products/"],
 ["POST","/products/"],["DELETE","/products/"]
]) {
  assert.ok(product.includes("authenticatedFetch("),verb+" "+endpoint+" must use common authenticatedFetch");
}
assert.match(shared,/if \(isolatedWebMode\) \{/);
assert.match(shared,/await stagingSession\(\)/);
assert.match(shared,/credentials: isolatedWebMode \? "same-origin"/);
assert.match(controller,/@UseGuards\(AuthGuard, CapabilityGuard\)/);
assert.match(controller,/@RequireCapability\(Capability\.HUSTLER\)/);
assert.match(service,/requireOwnedProduct\(profile\.id, productId\)/);
assert.match(service,/profile\.status !== ProfessionalProfileStatus\.PUBLISHED/);
assert.match(service,/moderationState: "CLEAR"/);
assert.match(editor,/await createProduct\(buildInput\(\)\)/);
assert.match(editor,/await publishProduct\(saved\.id\)/);
const proxy=load("apps/web/lib/api/isolated-web-proxy.ts");
const api=load("apps/api/src/staging-request-policy.ts");
const allowed=[
 ["GET","products/mine"],["GET","products/mine/test-1"],["GET","products/test-1"],
 ["POST","products"],["PUT","products/test-1"],
 ["POST","products/test-1/publish"],["POST","products/test-1/pause"],
 ["POST","products/test-1/variants"],["PUT","products/test-1/variants/var-2"],
 ["DELETE","products/test-1/variants/var-2"],["DELETE","products/test-1"]
];
for(const [verb,endpoint] of allowed) {
 const path="api/v1/"+endpoint;
 assert.equal(proxy.stagingProxyAllowed(verb,path.split("/")),true,
   "Proxy must allow owner product action "+verb+" "+endpoint);
 assert.equal(api.stagingRequestAllowed(verb,"/"+path),true,
   "API must allow owner product action "+verb+" "+endpoint);
}
const denied=[
 ["POST","orders"],["POST","orders/test-1/pay"],["POST","cart/items"],
 ["POST","products/test-1/pay"],["POST","products/test-1/checkout"],
 ["POST","products/test-1/refund"],["POST","products/test-1/variants/test-2/publish"],
 ["PUT","products/test-1/publish"],["PATCH","products/test-1"],
 ["DELETE","products"],["POST","wallet/deposit"],["POST","payments/initialize"],
 ["POST","admin/products"],["GET","admin/operations/users"]
];
for(const [verb,endpoint] of denied){
 const path="api/v1/"+endpoint;
 assert.equal(proxy.stagingProxyAllowed(verb,path.split("/")),false,
   "Proxy must deny unrelated/financial action "+verb+" "+endpoint);
 assert.equal(api.stagingRequestAllowed(verb,"/"+path),false,
   "API must deny unrelated/financial action "+verb+" "+endpoint);
}
console.log("PASS UX031: shared Better Auth for Products; explicit owner product routes only; payment and Order routes remain blocked.");
