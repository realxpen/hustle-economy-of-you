#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const card=read("apps/web/app/search/result-card.tsx");
const collection=read("apps/web/app/search/search-result-collection.tsx");
const page=read("apps/web/app/search/page.tsx");
const css=read("apps/web/app/search/search.module.css");
const api=read("apps/web/lib/search.ts");
// UX021 must remain a presentation-only refactor over true API results.
assert.match(collection,/items\.map\(\(item, index\)/);
assert.match(collection,/item\.kind === kind/);
assert.match(collection,/onOpen\(item, index\)/);
for(const kind of ["person","post","service","product"]){
  assert.match(collection,new RegExp('kind: "'+kind+'"'));
  if(kind!=="product") assert.match(card,new RegExp('item\\.kind === "'+kind+'"'));
}
assert.match(card,/className=\{styles\.discoveryProduct\}/);
assert.match(card,/href=\{href\}/);
assert.match(card,/item\.url \?\? "#"/);
assert.match(card,/window\.location\.assign\(href\)/);
assert.match(card,/item\.post\.media\[0\]/);
assert.match(card,/item\.service\.mediaUrls\?\.\[0\]/);
assert.match(card,/item\.product\.mediaUrls\?\.\[0\]/);
assert.match(card,/formatServicePrice\(item\.service\)/);
assert.match(card,/formatProductPrice\(item\.product\)/);
assert.doesNotMatch(card,/ranking\.score|RELEVANCE/);
assert.match(page,/<SearchResultCollection items=\{items\} tab=\{tab\}/);
assert.match(page,/onSelectTab=\{switchTab\}/);
assert.match(page,/getSearchPage\(nextTab/);
assert.match(page,/meta\.hasMore/);
assert.match(css,/discoveryPostVisual\{aspect-ratio:3\/4\}/);
assert.match(css,/discoveryPeople/);
assert.match(css,/discoveryServices/);
assert.match(css,/discoveryProducts/);
assert.match(api,/captureSearchObservation/);
console.log("PASS UX021: grouped real search results, visual media, per-type commerce, canonical routes and preserved search/pagination.");
