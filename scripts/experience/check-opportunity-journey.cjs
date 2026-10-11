#!/usr/bin/env node
// No credentials, network or production writes. Locks critical UX navigation
// and money-authority invariants; browser/runtime acceptance is separate.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const files = {
  feed: read("apps/web/app/home/page.tsx"),
  modal: read("apps/web/components/commerce/offer-quick-view.tsx"),
  source: read("apps/web/lib/opportunity-source.ts"),
  context: read("apps/web/components/commerce/opportunity-context.tsx"),
  storefront: read("apps/web/app/u/[username]/page.tsx"),
  service: read("apps/web/app/services/[serviceId]/page.tsx"),
  product: read("apps/web/app/products/[productId]/page.tsx"),
  booking: read("apps/web/app/bookings/new/[serviceId]/page.tsx"),
  cart: read("apps/web/app/cart/page.tsx"),
  checkout: read("apps/web/app/checkout/page.tsx")
};
assert.match(files.feed,/sourcePostId=\{item\.post\.id\}/,"Feed offers preserve source post context");
assert.match(files.modal,/withSourcePost\("\/bookings\/new\//,"Service Quick View connects to canonical Booking");
assert.match(files.modal,/Choose options & add to Cart/,"Product Quick View connects to canonical variant/cart");
assert.match(files.modal,/aria-modal="true"/,"Offer is a real dialog");
assert.match(files.modal,/event\.key !== "Tab"/,"Offer dialog traps keyboard focus");
assert.match(files.modal,/triggerRef\.current\?\.focus\(\)/,"Offer dialog restores focus");
assert.match(files.source,/\^\[A-Za-z0-9_-\]/,"Post navigation context is validated");
assert.match(files.source,/path\.split\("#"/,"Source query stays before product anchor");
assert.match(files.context,/Return to post/,"Original post is reachable");
assert.match(files.storefront,/href="#work"/,"Storefront keeps authentic proof reachable");
assert.match(files.storefront,/href="#services"/,"Storefront keeps actual service offers reachable");
assert.match(files.storefront,/href="#shop"/,"Storefront keeps actual product offers reachable");
for(const name of ["service","product","booking"]){
  assert.match(files[name],/active = false/,"Stale requests must be ignored: "+name);
  assert.match(files[name],/retryVersion/,"Canonical offer requests must be retryable: "+name);
  assert.match(files[name],/OpportunityContext/,"Opportunity continuity missing: "+name);
}
assert.match(files.service,/withSourcePost\(\`\/bookings\/new\//,"Service preserves context to booking");
assert.match(files.product,/<AddToCart key=\{product\.id\}/,"Product connects to current canonical Cart component");
assert.match(read("apps/web/app/products/[productId]/add-to-cart.tsx"),/id="add-to-cart"/);
assert.match(files.checkout,/PENDING Order/,"Checkout must not claim a payment happened");
assert.match(files.cart,/only a payment-provider confirmation/,"Cart must not claim payment success");
console.log("Core opportunity journey contract OK: Discover → Profile → Offer → Booking/Cart.");
