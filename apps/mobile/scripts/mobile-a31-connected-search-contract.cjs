#!/usr/bin/env node
"use strict";
/**
 * Connected MVP mobile search contract. Tests pure result projection against
 * API-shaped generated fixtures and the actual NestJS publicResult implementation.
 * Does not claim private API runtime/device acceptance or use live accounts.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const mobile = path.resolve(__dirname,"..");
const repo = path.resolve(mobile,"../..");
const read = p => fs.readFileSync(path.join(repo,p),"utf8");
const helperPath = path.join(mobile,"src/ux004/discovery/connectedSearchResult.ts");
const helperSource = fs.readFileSync(helperPath,"utf8");
const modelImport = helperSource.match(/import type \{ SearchResult \} from "([^"]+)"/);
assert.ok(modelImport, "Helper must import actual connected feed-api SearchResult type");
assert.ok(fs.existsSync(path.resolve(path.dirname(helperPath),modelImport[1]+".ts")),
  "Actual TypeScript import path must resolve (transpile-only Node tests erase type imports)");
const app = read("apps/mobile/src/experience/MobileExperience.tsx");
const client = read("apps/mobile/src/experience/feed-api.ts");
const server = read("apps/api/src/search/search.service.ts");
const manual = read(".github/workflows/hustle-offline-android-demo.yml");
const ci = read(".github/workflows/mobile-cloud-validation.yml");
const qa = read("Knowledge/QA/HUSTLE_MOBILE_A31_CONNECTED_SEARCH.md");

const compiled = ts.transpileModule(helperSource,{compilerOptions:{
  target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true
},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const m = new Module(helperPath,module);
m.filename=helperPath;
m.paths=Module._nodeModulePaths(path.dirname(helperPath));
m._compile(compiled.outputText,helperPath);
const {describeMobileSearchResult,connectedSearchWebLink}=m.exports;

function check(label,fn){fn();console.log("PASS: "+label);}
const fixture=[
  {kind:"person",id:"u1",person:{displayName:"Example Tailor",username:"example.tailor",location:"Yaba",professionalProfile:{primarySkill:"Tailoring"}},url:"/u/example.tailor"},
  {kind:"post",id:"post-01",post:{caption:"Fitting sample",category:"Fashion",location:"Lagos"},owner:{displayName:"Example Tailor"},url:"/posts/post-01"},
  {kind:"service",id:"service_01",service:{title:"Custom fitting",category:"Fashion",priceMinor:200000},owner:{displayName:"Example Tailor"},url:"/services/service_01"},
  {kind:"product",id:"product-01",product:{title:"Fabric sample",category:"Fashion"},owner:{displayName:"Example Tailor"},url:"/products/product-01"}
];

check("Existing NestJS search returns flattened canonical record shapes, not result.value",()=>{
  assert.match(server,/private publicResult\(result: RankedResult\) \{\s*return \{\s*kind: result\.kind,\s*id: result\.id,\s*\.\.\.result\.value,/);
  for(const url of ["/u/\${person.username}","/posts/\${post.id}","/services/\${service.id}","/products/\${product.id}"]) {
    assert.ok(server.includes("url: "+(url.startsWith("/u/")?"person.username ? \`/u/\${person.username}\`": "\`"+url+"\`")),url);
  }
  assert.doesNotMatch(client,/export type SearchResult = \{ kind: string; id: string; value:/);
  assert.match(client,/kind: 'person' \| 'post' \| 'service' \| 'product'/);
  assert.match(client,/person\?:/);
  assert.match(client,/post\?:/);
  assert.match(client,/service\?:/);
  assert.match(client,/product\?:/);
  assert.match(client,/owner\?:/);
});

check("Real read-model record kinds are projected to meaningful labels without invented reviews",()=>{
  assert.deepEqual(fixture.map(row=>describeMobileSearchResult(row).kindLabel),["Person","Post","Service","Product"]);
  assert.deepEqual(fixture.map(row=>describeMobileSearchResult(row).title),
    ["Example Tailor","Fitting sample","Custom fitting","Fabric sample"]);
  assert.match(describeMobileSearchResult(fixture[0]).detail,/Tailoring.*Yaba/);
  assert.match(describeMobileSearchResult(fixture[1]).detail,/Example Tailor/);
  for(const row of fixture) {
    const view=describeMobileSearchResult(row);
    for(const value of [view.title,view.detail,view.kindLabel])assert.ok(value&&typeof value==="string");
    assert.doesNotMatch(JSON.stringify(view),/verified|rating|available today|book now|checkout/i);
  }
  assert.equal(describeMobileSearchResult({...fixture[0],person:{}}).title,"Published professional");
  assert.equal(describeMobileSearchResult({...fixture[1],post:{}}).title,"Published work");
  assert.equal(describeMobileSearchResult({...fixture[2],service:{}}).title,"Published service");
  assert.equal(describeMobileSearchResult({...fixture[3],product:{}}).title,"Published product");
});

check("Only configured canonical public pages can leave app via explicit user action",()=>{
  const origin="https://hustle.test";
  assert.deepEqual(fixture.map(row=>connectedSearchWebLink(row,origin)),[
    origin+"/u/example.tailor",origin+"/posts/post-01",
    origin+"/services/service_01",origin+"/products/product-01"
  ]);
  assert.equal(connectedSearchWebLink(fixture[0],undefined),null);
  assert.equal(connectedSearchWebLink(fixture[0],"http://example.org"),null);
  assert.equal(connectedSearchWebLink(fixture[0],"javascript:alert(1)"),null);
  assert.equal(connectedSearchWebLink({...fixture[0],url:"https://evil.test/u/example.tailor"},origin),null);
  assert.equal(connectedSearchWebLink({...fixture[1],url:"//evil.test"},origin),null);
  assert.equal(connectedSearchWebLink({...fixture[1],url:"/posts/post-01?pay=1"},origin),null);
  assert.equal(connectedSearchWebLink({...fixture[1],id:"../admin",url:"/posts/../admin"},origin),null);
  assert.equal(connectedSearchWebLink({...fixture[0],person:{username:"bad/user"},url:"/u/bad/user"},origin),null);
  assert.equal(connectedSearchWebLink(fixture[0],"http://localhost:3000"),"http://localhost:3000/u/example.tailor");
});

check("Connected mobile Explore uses real flattened read models and guarded browser links",()=>{
  assert.match(app,/import \{ connectedSearchWebLink, describeMobileSearchResult \} from/);
  assert.match(app,/const view = describeMobileSearchResult\(result\)/);
  assert.match(app,/const url = connectedSearchWebLink\(result, process\.env\.EXPO_PUBLIC_PUBLIC_WEB_URL\)/);
  assert.match(app,/onPress=\{\(\) => openOpportunity\(result\)\}/);
  assert.match(app,/disabled=\{!opportunityPublicOffer\}/);
  assert.match(app,/accessibilityRole="button" accessibilityLabel=\{"Review " \+ view\.kindLabel/);
  assert.match(app,/await Linking\.openURL\(url\)/);
  assert.match(app,/Public offer link unavailable/);
  assert.doesNotMatch(app,/result\.value as/);
  assert.doesNotMatch(app,/https?:\/\/hustle\.example/);
  assert.doesNotMatch(app,/result\.value\?/);
});

check("Out-of-order query completions and edits cannot overwrite latest search state",()=>{
  assert.match(app,/const searchSeq = useRef\(0\)/);
  assert.match(app,/useEffect\(\(\) => \(\) => \{ searchSeq\.current \+= 1; \}, \[token\]\)/);
  assert.match(app,/function editSearch\(next: string\) \{\s*searchSeq\.current \+= 1;/);
  assert.match(app,/const seq = \+\+searchSeq\.current/);
  assert.match(app,/if \(seq === searchSeq\.current\) setSearchResults\(result\.items\)/);
  assert.match(app,/if \(seq === searchSeq\.current\) setSearchError\(/);
  assert.match(app,/if \(seq === searchSeq\.current\) setSearchLoading\(false\)/);
  assert.match(app,/onChangeText=\{editSearch\}/);
  assert.match(app,/onPress=\{\(\) => void runSearch\(category\)\}/);
  assert.doesNotMatch(app,/mobileApi\.search\(token, category\)\.then\(/);
  assert.match(app,/hasSearched \? "No published matches for this search/);
  assert.match(app,/Retry search/);
});

check("No new API writes, commerce, deployment or manual Expo build activation",()=>{
  assert.match(client,/api<SearchPage>\(token, '\/search\?q='/);
  assert.doesNotMatch(helperSource,/\bfetch\s*\(|\baxios|initializePayment|requestBooking/);
  assert.ok(ci.includes("node apps/mobile/scripts/mobile-a31-connected-search-contract.cjs"));
  assert.ok(manual.includes("node apps/mobile/scripts/mobile-a31-connected-search-contract.cjs"));
  assert.match(manual,/workflow_dispatch:/);
  assert.match(manual,/if: inputs\.approve_free_demo_build == true/);
  assert.ok(manual.indexOf("mobile-a31-connected-search-contract.cjs")<manual.indexOf("eas build --platform android"));
  assert.match(qa,/Runtime acceptance: PENDING/);
  assert.match(qa,/No Expo APK/);
});

console.log("Mobile A3.1 source and pure-helper contract PASS. Live authenticated data/browser/device QA PENDING.");
