# UX029 — Product shopping UI: visual continuity

## Founder direction and verified baseline
The founder approved a four-phone reference showing a combined marketplace, focused Services & Skills, focused Products, and media-first details. The existing real Product/Cart/Checkout flow functions and financial safety logic must **not** be redesigned as a different payment flow. UX028 is merged and deployed to the isolated iPhone preview.

## Scope
- Product Detail: published media gallery with real image/video previews and thumb selection, seller identity up front, clearer price/availability and an accessible sticky CTA that navigates to the **existing** Add to Cart control, not an unverified direct purchase.
- Product options and quantity: existing AddToCart component and authorization/API unchanged. Real variant, inventory, stock and currency still come from the public product API and AddToCart server response.
- Cart and Checkout: warm cream, deep forest, lime actions, compact review hierarchy and legible mobile price totals, using a **scoped** `shoppingExperience` class so unrelated commerce/order screens remain unchanged.
- Checkout still creates **unpaid PENDING Order** only. Inventory and price must be revalidated by backend; no fake payment, stock reservation, ratings or testimonials. Customer/creator single identity unchanged.

## QA and acceptance
- Product source/finance contract in Foundation CI verifies genuine media, variant/quantity Cart and protected Checkout paths.
- Guest-only Chromium fixture now supplies two **synthetic local SVG media files**, tests selection/price/cart anchor on Product Detail at 320/390/768 px and blocks all writes. This is an isolated visual regression fixture, not fake staging inventory or real checkout acceptance.
- Cloudflare compatibility, Foundation build and financial tests stay in place.
- Post-merge manual isolated iPhone visual acceptance required for Product Detail, Cart and Checkout with approved test accounts and no real payment.
