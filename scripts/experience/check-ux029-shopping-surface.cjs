#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=p=>fs.readFileSync(p,"utf8");
const product=read("apps/web/app/products/[productId]/page.tsx");
const productCss=read("apps/web/app/products/[productId]/page.module.css");
const cartWidget=read("apps/web/app/products/[productId]/add-to-cart.tsx");
const cart=read("apps/web/app/cart/page.tsx");
const checkout=read("apps/web/app/checkout/page.tsx");
const commerce=read("apps/web/app/commerce.module.css");
const browser=read("scripts/experience/local-ux013-journeys.cjs");
// Product detail: real published media with accessible user-selected view,
// never synthetic ratings/photos/stars or new payment paths.
assert.match(product,/const heroMedia = product\.mediaUrls\[Math\.min\(activeMediaIndex/);
assert.match(product,/setActiveMediaIndex\(index\)/);
assert.match(product,/aria-pressed=\{activeMediaIndex === index\}/);
assert.match(product,/className=\{styles\.productGallery\}/);
assert.match(product,/className=\{styles\.sellerSummary\}/);
assert.match(product,/href=\{\x60\/u\/\$\{owner\.username\}\x60\}/);
assert.match(product,/href="#add-to-cart"/);
assert.match(product,/role="region" aria-label="Product purchase action"/);
assert.match(product,/formatProductPrice\(product\)/);
assert.match(product,/product\.inStock/);
assert.match(productCss,/\.stickyPurchase\{position:fixed/);
assert.match(productCss,/\.galleryThumbnails button\.selectedMedia/);
assert.doesNotMatch(product,/rating: ?4\.|reviewCount: ?[0-9]+|fake|mock image/i);
// Real cart behavior is untouched, only UX surfaces changed.
assert.match(cartWidget,/await addCartItem\(\{/);
assert.match(cartWidget,/productVariantId: variantId/);
assert.match(cartWidget,/quantity/);
assert.match(cartWidget,/Adding to Cart does not reserve inventory or charge you/);
assert.match(cart,/await updateCartItem\(itemId, quantity\)/);
assert.match(cart,/await removeCartItem\(itemId\)/);
assert.match(cart,/await clearCart\(\)/);
assert.match(cart,/href="\/checkout"/);
assert.match(cart,/data-hustle-shopping="cart"/);
assert.match(checkout,/await getCheckoutPreview\(\)/);
assert.match(checkout,/await checkout\(form\)/);
assert.match(checkout,/preview\.inventoryPolicy/);
assert.match(checkout,/Create unpaid Order/);
assert.match(checkout,/data-hustle-shopping="checkout"/);
assert.match(commerce,/\.shoppingExperience\{background:#F7F6F2;color:#18281E/);
assert.match(commerce,/\.shoppingExperience \.buttonAlt\{display:grid;place-items:center/);
assert.match(browser,/UX029 Product detail real-media gallery/);
assert.match(browser,/getByRole\("button",\{name:"View product media 2"\}\)\.click\(\)/);
console.log("PASS UX029: real media, seller, variant/cart, order preview and unpaid checkout with scoped iPhone styling.");
