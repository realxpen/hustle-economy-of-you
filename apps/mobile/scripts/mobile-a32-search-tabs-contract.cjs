#!/usr/bin/env node
"use strict";
/**
 * Mobile A3.2 connected search navigation + paging:
 * actual typed API path builder and deduplication executed in Node with
 * synthetic search records; screen API/UI source and backend routes validated.
 * Neither live authenticated access nor device behavior is simulated.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const mobile = path.resolve(__dirname, "..");
const repo = path.resolve(mobile, "../..");
const read = p => fs.readFileSync(path.join(repo,p),"utf8");
const app = read("apps/mobile/src/experience/MobileExperience.tsx");
const api = read("apps/mobile/src/experience/feed-api.ts");
const controller = read("apps/api/src/search/search.controller.ts");
const server = read("apps/api/src/search/search.service.ts");
const oldContract = read("apps/mobile/scripts/mobile-a31-connected-search-contract.cjs");
const qa = read("apps/mobile/docs/MOBILE_A32_CONNECTED_SEARCH_TABS.md");

function load(relative) {
  const filename=path.join(mobile,relative);
  const code=fs.readFileSync(filename,"utf8");
  // Catch type-only import mistakes before TS strips them for the Node test.
  for(const match of code.matchAll(/import type \{[^}]+\} from ["']([^"']+)["']/g)) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(filename),match[1]+".ts")),
      "Missing type import target: "+relative+" -> "+match[1]);
  }
  const out=ts.transpileModule(code,{compilerOptions:{
    target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true
  },reportDiagnostics:true});
  assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
  const mod=new Module(filename,module);
  mod.filename=filename;
  mod.paths=Module._nodeModulePaths(path.dirname(filename));
  mod._compile(out.outputText,filename);
  return mod.exports;
}
const {searchTabPath}=load("src/experience/feed-api.ts");
const {appendUniqueSearchResults}=load("src/ux004/discovery/connectedSearchPagination.ts");
function check(label,fn){fn();console.log("PASS: "+label);}

check("Five search tabs match server's already existing authorised read endpoints",()=>{
  for(const [tab,suffix] of [
    ["top","/search"],["people","/search/people"],["posts","/search/posts"],
    ["services","/search/services"],["products","/search/products"]]) {
    assert.equal(searchTabPath(tab,"tailor"),suffix+"?q=tailor&limit=16");
  }
  assert.match(controller,/@Get\(\)/);
  assert.match(controller,/@Get\(":tab"\)/);
  assert.match(server,/new Set<SearchTab>\(\["top", "people", "posts", "services", "products"\]\)/);
  assert.match(api,/export type SearchTab = 'top' \| 'people' \| 'posts' \| 'services' \| 'products'/);
  assert.match(api,/searchTab: \(token: string, tab: SearchTab, query: string, cursor\?: string \| null\)/);
  assert.match(api,/api<SearchPage>\(token, searchTabPath\(tab, query, cursor\)\)/);
  assert.match(api,/search: \(token: string, query: string\) =>\s*api<SearchPage>\(token, '\/search\?q='/);
});

check("Search tab requests safely encode query and server cursor without accidental truncation",()=>{
  assert.equal(searchTabPath("posts","two-piece & fade","cursor/+=?!"),
    "/search/posts?q=two-piece%20%26%20fade&limit=16&cursor=cursor%2F%2B%3D%3F!");
  assert.equal(searchTabPath("top","Lagos artisan",null),"/search?q=Lagos%20artisan&limit=16");
  assert.equal(searchTabPath("products","a#b?c"),"/search/products?q=a%23b%3Fc&limit=16");
  const routeSource=api.slice(api.indexOf("export function searchTabPath"),api.indexOf("const base ="));
  assert.doesNotMatch(routeSource,/bookings|payment|escrow/);
});

check("Cursors append in stable server relevance order and deduplicate by kind plus canonical ID",()=>{
  const first=[{kind:"person",id:"same"},{kind:"post",id:"p1"},{kind:"service",id:"s1"}];
  const next=[{kind:"post",id:"p1"},{kind:"product",id:"same"},{kind:"product",id:"same"},
    {kind:"person",id:"same"},{kind:"post",id:"p2"}];
  const firstBefore=JSON.stringify(first),nextBefore=JSON.stringify(next);
  const merged=appendUniqueSearchResults(first,next);
  assert.deepEqual(merged.map(x=>x.kind+":"+x.id),[
    "person:same","post:p1","service:s1","product:same","post:p2"
  ]);
  assert.deepEqual(appendUniqueSearchResults([],[]),[]);
  assert.equal(JSON.stringify(first),firstBefore);
  assert.equal(JSON.stringify(next),nextBefore);
  assert.notEqual(merged,first);
});

check("Connected Explore switches actual API tabs instead of filtering one mixed response locally",()=>{
  assert.match(app,/const SEARCH_TABS: ReadonlyArray<\{ id: SearchTab; label: string \}>/);
  for(const name of ["Top","People","Posts","Services","Products"])
    assert.ok(app.includes("label: '"+name+"'"),name);
  assert.match(app,/const \[searchTab, setSearchTab\] = useState<SearchTab>\('top'\)/);
  assert.match(app,/async function runSearch\(input: string, tab: SearchTab = searchTab\)/);
  assert.match(app,/await mobileApi\.searchTab\(token, tab, query\)/);
  assert.match(app,/function chooseSearchTab\(tab: SearchTab\) \{\s*if \(searchTab === tab\) return;\s*\/\//);
  assert.match(app,/void runSearch\(searchText, tab\)/);
  assert.match(app,/accessibilityRole="tab"/);
  assert.match(app,/accessibilityState=\{\{ selected: searchTab === tab\.id \}\}/);
  assert.match(app,/searchTabChoice: \{ minHeight: 44/);
});

check("Tab changes, edited queries and pagination cannot overwrite a more recent search",()=>{
  assert.match(app,/const searchSeq = useRef\(0\)/);
  assert.match(app,/const searchMorePending = useRef\(false\)/);
  assert.match(app,/function editSearch\(next: string\) \{\s*searchSeq\.current \+= 1/);
  assert.match(app,/const seq = \+\+searchSeq\.current/);
  assert.match(app,/searchMorePending\.current = false/);
  assert.match(app,/if \(seq === searchSeq\.current\) setSearchResults\(result\.items\)/);
  assert.match(app,/if \(seq === searchSeq\.current\) setSearchLoading\(false\)/);
  assert.match(app,/const seq = searchSeq\.current;\s*const cursor = searchCursor;\s*const tab = searchTab/);
  assert.match(app,/if \(seq !== searchSeq\.current\) return/);
  assert.match(app,/setSearchResults\(old => appendUniqueSearchResults\(old, page\.items\)\)/);
  assert.match(app,/setSearchHasMore\(page\.hasMore\)/);
  assert.match(app,/setSearchCursor\(page\.nextCursor\)/);
  assert.match(app,/setSearchMoreError\(err instanceof Error/);
});

check("Search uses truthful pagination and explicit accessible load-more or retry actions",()=>{
  assert.match(app,/const \[searchHasMore, setSearchHasMore\] = useState\(false\)/);
  assert.match(app,/const \[searchMoreLoading, setSearchMoreLoading\] = useState\(false\)/);
  assert.match(app,/const \[searchMoreError, setSearchMoreError\] = useState\(''\)/);
  assert.match(app,/async function loadSearchMore\(\)/);
  assert.match(app,/await mobileApi\.searchTab\(token, tab, query, cursor\)/);
  assert.match(app,/Showing \{searchResults\.length\} published/);
  assert.match(app,/searchHasMore \? ' · More available'/);
  assert.match(app,/accessibilityLabel=\{searchMoreError \? "Retry loading more search results" : "Load more search results"\}/);
  assert.match(app,/onPress=\{\(\) => void loadSearchMore\(\)\}/);
  assert.match(app,/searchLoadMore: \{ minHeight: 48/);
  assert.match(app,/hasSearched \? "No published matches for this search/);
  assert.match(app,/disabled=\{!url\} onPress=\{\(\) => void openSearchResult\(result\)\}/);
});

check("A3.1 regression remains present and only apps/mobile changes needed",()=>{
  assert.ok(oldContract.includes("connectedSearchWebLink"));
  assert.ok(oldContract.includes("Public link unavailable"));
  assert.match(app,/EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== 'true'/);
  assert.doesNotMatch(app,/createClient\(|initializePayment\(|escrow\.release/);
  assert.match(qa,/Runtime acceptance: PENDING/);
  assert.match(qa,/No Expo APK/);
  const dispatcher=read("apps/mobile/scripts/mobile-experience-contract.mjs");
  assert.ok(dispatcher.includes("mobile-a32-search-tabs-contract.cjs"));
});

console.log("Mobile A3.2 connected Search tabs and cursor regression PASS; real signed-in Android acceptance PENDING.");
