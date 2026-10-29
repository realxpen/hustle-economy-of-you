#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const market=read("apps/web/app/marketplace/page.tsx");
const css=read("apps/web/app/marketplace/marketplace.module.css");
const card=read("apps/web/app/marketplace/marketplace-offer-card.tsx");
const detail=read("apps/web/app/services/[serviceId]/page.tsx");
const detailCss=read("apps/web/app/services/[serviceId]/page.module.css");
const api=read("apps/web/lib/search.ts");

// One real-data backed marketplace; focus does not alter account role.
assert.match(market,/getMarketplacePage\("services",/);
assert.match(market,/getMarketplacePage\("products",/);
assert.match(market,/getMarketplacePage\(nextView/);
assert.match(market,/aria-label="Marketplace modes"/);
assert.match(market,/aria-pressed=\{view === mode\.id\}/);
assert.match(market,/marketplaceRoute\(nextView/);
assert.match(market,/const categories = useMemo/);
assert.match(market,/categorySymbol\(category\)/);
assert.match(market,/aria-label="Categories from loaded offers"/);
assert.match(market,/className=\{styles\.featureBanner\}/);
assert.match(market,/const browsingTopics = \["Beauty", "Home", "Technology"/);
assert.match(market,/browseCategories\.map\(category/);
assert.doesNotMatch(market,/firstPublishedServicePhoto/);
assert.match(market,/className=\{styles\.bannerGlyph\}/);
assert.match(market,/Published services and skills/);
assert.match(market,/Published products/);
assert.match(market,/singleOfferGrid/);
assert.match(market,/singleProductGrid/);
assert.match(market,/No products listed yet/);
assert.match(css,/\.servicesGrid,.productsGrid\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
assert.match(css,/\.featureBanner\{grid-template-columns:minmax\(0,1\.2fr\)/);
assert.match(css,/background-color:#F7F6F2/);
assert.match(card,/formatServicePrice\(item\.service\)/);
assert.match(card,/formatProductPrice\(item\.product\)/);
assert.match(card,/href=\{destination\}/);
assert.match(card,/item\.owner\.avatarUrl/);
assert.doesNotMatch(market,/Math\.random\(\)\s*\*\s*[45]/);
assert.ok(api.includes('const route = tab === "all" ? "/marketplace" : `/marketplace/${tab}`;'));

// Service detail is real published work, provider trust and canonical booking.
assert.match(detail,/className=\{styles\.mediaGallery\}/);
assert.match(detail,/setActiveMediaIndex\(index\)/);
assert.match(detail,/service\.mediaUrls\.map\(\(url, index\)/);
assert.match(detail,/isVideo\(selectedMedia\)/);
assert.match(detail,/trust\.reviews\.items\.length > 0/);
assert.match(detail,/className=\{styles\.stickyBooking\}/);
assert.match(detail,/href=\{preparedBookingHref\}/);
assert.match(detail,/href=\{consultHref\}/);
assert.match(detail,/requireAuthForAction\(/);
assert.match(detail,/formatServicePrice\(service\)/);
assert.match(detailCss,/\.stickyBooking\{position:fixed/);
assert.match(detailCss,/\.galleryStage\{aspect-ratio:1\.33 \/ 1/);
console.log("PASS UX027: actual marketplace home, separate focus grids, category chips, published media gallery and genuine booking CTA.");
