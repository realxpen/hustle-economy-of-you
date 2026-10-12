# Shared Glass & Frictionless Navigation — Web Acceptance

Date: 2026-10-12
Status: PR #101 MERGED 2026-10-12 (a9331761963c6f578891dc81dd4009349070dd24); Foundation CI 38252018659 SUCCESS on final head ae995301a74c0e3f4592f04451e7d685068053db. Owner Web release and signed-in cross-device acceptance PENDING.

## Intended UX
- Search has ONE persistent mobile entry point in the dock, not another magnifier at Discover top-right. Desktop header Search remains discoverable. Two top Discover actions: Stories and Create; Create goes DIRECTLY to Post composer.
- On root-level mobile screens, repetitive header breadcrumbs are hidden. On detail/transaction screens, contextual breadcrumb and back-navigation remain visible.
- High-opacity glass surfaces and clean muted outlines unify Home, Search, Market, Booking, Orders, Cart, Checkout, Messages, Notifications, Wallet, Storefront, You, Studio, Agent, Story and Live.
- Blur is behind controls, not over media, caption text, receipts or money/trust states. Contrast and backend authority take priority over decoration.
- Light/Dark/System with less-transparency fallback, 44px touch targets for quick actions, readable tabs/forms/statuses and no forced browser zoom.

## Required release QA (NOT completed)
- [ ] iPhone Safari at 320/360/375/390/430 CSS px, normal and enlarged site text 100/125/150/200%, portrait/landscape, safe-area/keyboard and varying address-bar sizes.
- [ ] Android Chrome small screen/light/dark; no clipped Search tab, Feed rail, Offer controls, Story action or mobile dock.
- [ ] Desktop/tablet at 768/1024/1440 widths, keyboard only, 200% browser zoom: coherent glass hierarchy, visible focus, no nested excessive nav or unreadable layers.
- [ ] Discover mobile: ONLY Stories & Create in top-right; global Search dock still works; Create opens /posts/new directly; Story shortcut opens real /stories; tab filters and separate Live retain state.
- [ ] Service/Product/Card/Cart/Checkout monetary amounts, actual stock/availability, pending-paid distinctions and trust/private warnings maintain contrast. Never imply payment by client-side animation.
- [ ] Story/Live dark glass; video/photos remain sharp and visible, caption/reply/action legibility; host transport/permissions not bypassed.
- [ ] You/Hustler Profile/Agent screens show real capabilities and verified contact state; no false verification or Agent finance powers.
- [ ] Check that browser low-power/reduced transparency, reduced motion and no `backdrop-filter` support preserve solid readable panels.
- [ ] Real signed-in journey: Discover → offer quick view → authentic seller → consultation → Booking or Cart; return from Messages; no additional needless Search links/modal steps.
- [ ] Confirm all 6 dock routes and desktop nav survive, and no accidental duplicate actions in header/quick actions.
- [ ] Sign-in, onboarding, application, privacy consent and safety reporting remain legible with no hidden fields or newly automatic destructive actions.
- [ ] Compare Vercel production SHA to merged approved commit before treating screenshots as acceptance; owner manually deploys.
- [ ] Existing Builds #96–#100 device/permission/payment sandbox acceptance remains required.

## Proof hierarchy
1. Source contracts + 4 workspace TypeScript checks + Prisma + Web/Admin/API builds + local Chromium public-shell responsive smoke.
2. Owner-deployed Web with matching SHA and read-only responsive audit.
3. Signed-in physical Safari/Android and isolated payment/Agent permission tests. The first tier cannot certify tiers 2 or 3.
