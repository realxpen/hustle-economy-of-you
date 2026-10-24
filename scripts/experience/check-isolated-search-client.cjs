#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "../..");
const file = path.join(root, "apps/web/lib/search.ts");
const source = fs.readFileSync(file, "utf8");
assert.match(source, /import \{ authenticatedFetch \} from "\.\/api\/authenticated-fetch";/,
  "Explore must use Home's existing authenticated API");
assert.doesNotMatch(source, /getSupabaseBrowserClient|NEXT_PUBLIC_API_URL|const apiBase\s*=/,
  "Explore must never reconnect to an unconfigured Supabase client");
const api = fs.readFileSync(path.join(root, "apps/web/lib/api/authenticated-fetch.ts"), "utf8");
assert.match(api, /isolatedWebMode \? "\/api\/isolated\/api\/v1"/);
assert.match(api, /stagingSession\(\)/);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {module: ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const requests = [];
const mod = new Module(file,module);
mod.filename=file;
mod.paths=Module._nodeModulePaths(path.dirname(file));
const req = mod.require.bind(mod);
mod.require = name => name === "./api/authenticated-fetch"
  ? {authenticatedFetch: async (url,init) => {
      requests.push({url,init});
      return {json: async () => ({mode:url.startsWith("/marketplace")?"marketplace":"search",
        tab:"top",query:null,filters:{},items:[],nextCursor:null,hasMore:false,zeroResults:true})};
    }}
  : req(name);
mod._compile(transpiled,file);
(async()=>{
 const t=mod.exports;
 const tabs=["top","people","posts","services","products"];
 for(const tab of tabs){
   const res=await t.getSearchPage(tab,{q:" Barber home services ",limit:12,filters:{
     location:"Lagos",category:"Beauty",nearby:false,verified:"true"
   }});
   assert.equal(res.zeroResults,true);
   const url=requests.at(-1).url;
   assert(url.startsWith(tab==="top"?"/search?":"/search/"+tab+"?"),url);
   const qs=new URLSearchParams(url.split("?")[1]);
   assert.equal(qs.get("q"),"Barber home services");
   assert.equal(qs.get("limit"),"12");
   assert.equal(qs.get("location"),"Lagos");
   assert.equal(qs.get("verified"),"true");
   assert.equal(qs.get("category"),"Beauty");
 }
 for(const tab of ["all","services","products"]){
   await t.getMarketplacePage(tab,{q:"tailor",limit:8});
   assert(requests.at(-1).url.startsWith(tab==="all"?"/marketplace?":"/marketplace/"+tab+"?"));
 }
 await t.captureSearchObservation("search.performed",{query:"barber",sessionId:"fixture"});
 assert.equal(requests.at(-1).url,"/search/events");
 assert.equal(requests.at(-1).init.method,"POST");
 const page = fs.readFileSync(path.join(root,"apps/web/app/search/page.tsx"),"utf8");
 assert.match(page,/getSearchPage\(nextTab/);
 assert.match(page,/Explore skills/);
 assert.match(page,/aria-expanded=\{filtersExpanded\}/);
 console.log("PASS: Explore + Marketplace use staging Better Auth client; exact search tabs and filters preserved.");
})().catch(e=>{console.error(e);process.exitCode=1});
