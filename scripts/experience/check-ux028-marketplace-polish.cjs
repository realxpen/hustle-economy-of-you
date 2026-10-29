#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=(path)=>fs.readFileSync(path,"utf8");
const page=read("apps/web/app/marketplace/page.tsx");
const css=read("apps/web/app/marketplace/marketplace.module.css");
const cards=read("apps/web/app/marketplace/marketplace-offer-card.tsx");
const browser=read("scripts/experience/local-ux013-journeys.cjs");
// Screenshot UX028: 1 published service + 0 products. Never invent ratings,
// people, inventory or duplicated promotional images to fill empty space.
assert.match(page,/const browsingTopics = \["Beauty", "Home", "Technology", "Fashion", "Food", "Creative"\]/);
assert.match(page,/browseCategories\.map\(category/);
assert.match(page,/role="group" aria-label="Marketplace modes"/);
assert.match(page,/getMarketplacePage\("services"/);
assert.match(page,/getMarketplacePage\("products"/);
assert.match(page,/filterIconButton/);
assert.match(page,/aria-expanded=\{filterOpen\}/);
assert.match(page,/className=\{styles\.bannerGlyph\}/);
assert.doesNotMatch(page,/firstPublishedServicePhoto|bannerPhoto/);
assert.match(page,/No products listed yet/);
assert.match(page,/categorySymbol\(category\)/);
assert.match(page,/marketplaceRoute\(nextView/);
assert.match(cards,/href=\{destination\}/);
assert.match(cards,/formatServicePrice\(item\.service\)/);
assert.match(cards,/formatProductPrice\(item\.product\)/);
assert.match(css,/\.singleOfferGrid,.singleProductGrid\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/\.bannerGlyph\{position:relative/);
assert.match(css,/\.emptyProductNote\{display:grid;grid-template-columns:36px minmax\(0,1fr\)/);
assert.match(css,/\.searchSubmit\{flex:0 0 40px;width:40px;min-height:40px/);
assert.match(browser,/a lone service must not expand into an oversized full-width card/);
console.log("PASS UX028: compact real-iPhone cards, themed brand banner, browse categories and truthful empty inventory.");
