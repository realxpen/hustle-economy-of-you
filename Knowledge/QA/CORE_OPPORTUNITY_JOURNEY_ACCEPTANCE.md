# Core Opportunity Journey — MVP Frontend Acceptance

Status: PR #96 MERGED 2026-10-11 (9913e67cfc9e6c166fcbf312e37373467f8b1e31); Foundation CI 38158161163 SUCCESS on final head abceb5f22d901d609c972bcdde3280100c6d0fdb. Real browsers, owner's Web release and signed-in acceptance PENDING.
Date: 2026-10-11
Scope: Next.js Web Discover → Hustler Storefront → canonical Service/Product → Booking/Cart. No backend, finance, schema, or Agent permission changes.

## Reason for this pass
The content-first Discover viewer now has clickable server-backed Service and Product references. A user must be able to retain proof and creator context while evaluating an offer and moving into booking or purchase. The existing quick view offered mostly "view detail" navigation with no return-to-post context, and public detail requests could resolve out of order if the route changed.

## Implemented
- Feed quick view passes the genuine current post ID as **navigation-only** context.
- Service quick view offers Request Booking, Review Details, Meet Hustler and Return to Post. Product quick view offers Choose Options & Add to Cart (canonical Product detail anchor), Review Product, Meet Hustler and Return to Post.
- Source-post context is format-validated for navigation, **never treated as proof of a valid attachment** and never used as an entitlement, payment authority or attribution event. Canonical API still decides offer price, owner, stock, availability and financial state.
- Quick-view dialog traps keyboard Tab focus, handles Escape, restores trigger focus on close and keeps real server-backed metadata.
- Public Service/Product/Booking pages guard against stale async resolutions after route change and expose retryable loading errors. Service preserves source context to Booking request; Booking preserves paths to source post, real owner storefront and the canonical Service terms.
- Public Hustler Storefront places small proof-to-services/products decision shortcuts above the stats for easier discovery.
- Product detail shows real image contained (not crop-only background), native video where URL is a video, and an Add to Cart anchor with variant selection still required.
- Cart and product form copy now describe unpaid Order/payment provider authority without internal phase labels.
- Static journey contract in Foundation CI; all changes confined to Web UX and docs.

## Browser/manual acceptance — NOT completed
- [ ] Discover → attached SERVICE quick view → Book request → submit test booking only in authorized sandbox; real booking writes must not be part of automated read-only checks.
- [ ] Discover → attached PRODUCT quick view → Product variant → Cart → Checkout preview; do not create real Orders or payment events in unattended tests.
- [ ] Quick view on 320/360/390/430/768/1024/1440px: no clipped actions, keyboard focus stays inside, Escape closes, focus returns to the exact post offer trigger.
- [ ] Service/Product page can switch rapidly between IDs; no stale owner, title, price or media should show for the new route. Error can retry.
- [ ] Opening an offer from a post permits "Return to post" without representing a supplied URL parameter as verified provenance. Direct links without sourcePost still render correctly.
- [ ] Public storefront: Work, Services, Products and message flows reach the right authenticated/public paths, including empty sections and unpublished offerings.
- [ ] Booking: availability remains server-checked; request does not fund/charge/confirm. Product: inventory and variant remain server-checked before any authoritative payment.
- [ ] iPhone Safari small and enlarged text, Android Chrome, desktop keyboard and reduced-motion: no modal overlap or inaccessible buttons.
- [ ] Light/dark/system contrast; seller badges only show verified statuses when backed by real trust data.
- [ ] Owner deploys Web via manual GitHub Actions after approval. No assistant production deployment.

## Follow-up stabilization work
Live content/media, full signed-in real-user journey, wallet/payment sandbox, Agent permission boundaries and cross-browser screenshot comparisons remain distinct release gates. Builds/static contracts alone do not prove runtime acceptance.
