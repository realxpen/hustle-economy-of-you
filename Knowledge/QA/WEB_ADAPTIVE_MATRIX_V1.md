# Web Adaptive Layout Matrix V1 — viewport & browser contract

Status: PR #92 MERGED 2026-10-11 at 589552206f92706e1c847dcf86490140289ee5ae. Foundation CI 38120428789 SUCCESS on final head 8b8c2ac4ef2ea93777fdba66ba5c693aee44a8c3; viewport browser audit and signed-in runtime/device acceptance still PENDING.
Date: 2026-10-11
Scope: Next.js Web app. React Native/Expo Mobile and Admin are separate interfaces and cannot be certified by Web CI.

## Problem and design principles
Repeated owner screenshots at different resolutions and on iPhone Safari showed mobile clipping and an empty/black media stage. Earlier PRs applied local visual patches, which were insufficient to prevent regressions when browser text zoom/rotation or alternative content changes the effective viewport.

**Adaptive means content priority and functional reachability at actual CSS viewport widths**, not a visually identical screenshot at every device. Browser zoom changes the CSS viewport width; do not use user-scalable=no or artificial zoom normalization. For dense/complex states, allow a deliberately scoped inner scroll (cards, media stages, sheets) rather than globally clipping authentic controls.

## Implemented
- Adaptive foundation imported once at root: constrained media, min-content shrink, long text recovery, keyboard focus, native form-text sizing on narrow mobile Safari, overflow-safe code/tables and reduced-motion scroll handling.
- Targeted responsive CSS for Search + Marketplace, Cart/Checkout/Orders + Wallet-adjacent shared commerce, Bookings, Messages, Activity, Services, Products, Live, Agent permissions, public Hustler storefront, shared header/dock.
- Additional guards for Post details and comment threads, Service/Product editors and management, professional profile, Hustler application, Stories and reactions, authoritative attached-offer modal.
- A short-height fallback for the Discover action rail to avoid collisions with an authentic long caption/offer panel.
- CI static contract script checks 16 real core routes, 13 core CSS modules, shared import, six canonical mobile nav links and baseline responsive rules.
- Manually dispatchable **Hustle Responsive Browser Audit** in GitHub Actions: read-only Chromium checks at 320, 360, 390, 430, 600, 768, 1024, 1440 CSS px; reports horizontal overflow, offscreen fixed navigation, and small iOS form field fonts. It does not log in, submit, or deploy. Protected routes redirected to /auth are reported UNVERIFIED, never silently counted as passing. Detailed signed-in testing requires a secure **local** browser session state, not production credentials in GitHub.

## Visual/runtime acceptance matrix — not yet completed
Viewport targets and equivalent zoom:
- Phone: 320×568, 360×740, 375×667, 390×844, 430×932 portrait; phone landscape including 568×320.
- Tablet: 600, 768, 820, 1024 CSS px in both orientations.
- Desktop: 1280×720, 1366×768, 1440×900, 1920×1080.
- Browser zoom 100%, 125%, 150%, 200%, 300%, 400% — judge **actual CSS viewport** and legibility, not physical pixels.
- Safari iOS, Chrome Android, Chrome/Edge/Firefox desktop, Safari macOS; light/dark/system, reduced motion, high contrast and keyboard navigation.

Per-area checks, all PENDING runtime acceptance:
- Discover: viewport post stage, isolated snap scrolling, first content image loading/error/retry, muted video, no clipped rail/footer/offer, 0/1/multiple posts, long caption, attached multi-offer quick view, Live and other tab links.
- Search/Marketplace: complete Search filters, URL-prefill, grid/card collapse and horizontal filter strip at 320 and 200% zoom.
- Public storefront, Services/Products: long name/price, media, verified badges, booking and order links, variant choices, persistent authenticity.
- Messages/Activity: inbox, unread filters, thread keyboard/attachment composer and notification list.
- Wallet/Cart/Checkout/Bookings/Orders: financial amounts always legible; no invented balance, double charge or payment-success state. Never exercise real transactions in browser smoke audit.
- Live/Stories: media viewer, short landscape height, comment entry, sheet closings, reduced-motion behavior, external video permission and audio user choice.
- Agent workspace: approved scopes, principal switching/consent/revocation remains server-enforced; UI must not offer finance delegation.
- Creation/editor/onboarding: label legibility, photo/video previews, real upload progress, keyboard form navigation and error states.
- Browser chrome: iOS Safari expanded and collapsed bottom address bar, safe-area, zoom on field focus, dynamic keyboard raising, rotation and desktop resized to phone width.
- Stress: 200-character unbroken strings, 200% text size, unusually large media aspect ratio, slow/offline/failed media URLs, low height with modal or multi-offer panel open.
- Screen reader labels/focus, reduced-motion, semantic Live links, consent and checkout action accessibility.

## How to run
1. Push feature branch; GitHub Foundation CI runs the **Responsive UI contract checks**, four workspace typechecks, Prisma generation and Web/Admin/API production builds.
2. Once owner approves a deployment, manually run **Hustle Responsive Browser Audit** from GitHub Actions with the deployed HTTPS Web root; it is **read-only**, not the production deployment workflow. The run explicitly reports routes it cannot exercise due to sign-in.
3. On signed-in iPhone/Android/tablet/desktop, run matrix above with genuine owner-approved test data. Do not upload or commit browser cookie/session files; run optional authenticated Playwright smoke only on a trusted local machine.
4. File and resolve remaining real-device failures. Repeat after next code/deploy. Passing builds + CSS contract is not a guarantee of every screen/browser/content state.

## Scope limitations
No browser has executed the full matrix yet. Static CSS and typecheck tests do **not** prove real-world layout or all combinations. Native app RN/Expo and Admin require their own platform-specific QA; do not claim this Web change certifies them.


## 2026-10-11 — owner iPhone Safari text-size screenshots after PR #92
Three provided captures at differing browser text sizes confirm an unverified real failure even after the Web-wide adaptive foundation: at larger text scale the engagement rail becomes a horizontal line of buttons over the T-shirt, and the attached-offers control is cut off at the mobile dock. At smaller text size the media and controls are significantly more usable. The appearance selector also truncates “System” to “Syst”.

**Root cause in code:** `@media(max-width:760px) and (max-height:600px)` switches Discover's engagement controls to `flex-direction:row` without checking landscape orientation. Safari's effective CSS viewport height can drop below the breakpoint in portrait when text size/browser chrome changes. Separately the footer had a maximum height but `overflow:visible`, allowing offers to spill out of the portrait stage under the fixed dock. The theme selector retained a 66px max-width although the adaptive input rule increases select font size to 16px.

Resolution candidate: restrict horizontal action dock to **landscape only**, explicitly anchor a vertical portrait rail above the measured footer, make footer a bounded column with captions scrolling and attached offers anchored/scrollable, plus give System selector enough width. Add those conditions to the existing responsive CI contract.

- [ ] iOS portrait Safari/Chrome at small, default and large website text settings: rail stays vertical, Follow and attached-offer CTA accessible, no overlap with six-route dock.
- [ ] Short portrait height, expanded offers and long caption: visible offer toggle and independently scrollable controls rather than clipped controls.
- [ ] Landscape retains compact horizontal action rail and native feed gestures.
- [ ] System/Light/Dark selector text is fully visible, remains keyboard/VoiceOver operable.
- [ ] Live first post image, pagination, story/create links and attached service/product quick views work after owner-authorized release.
