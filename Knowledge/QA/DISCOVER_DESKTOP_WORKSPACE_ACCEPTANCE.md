# Discover Desktop Workspace — Acceptance Checklist

Date: 2026-10-12
Status: PR #103 merged and owner-deployed to Web; screenshot reviewed. New contextual-density refinement CI/runtime acceptance pending.

## Visual matrix
- [ ] Desktop signed-in 1120×700: full-size authentic post media + adjacent external action rail + legible context panel; no horizontal overflow.
- [ ] Desktop signed-in 1440×900 (dark/light/system): workspace occupies intentional horizontal space; creator, details and real attached offers remain legible.
- [ ] Desktop 1920×1080: centered composition is proportional, without inflating user video or stretching media content.
- [ ] Desktop short-height / 200% browser zoom: sensible bounded single-stage fallback; navigation, media, caption and buttons usable.
- [ ] Tablet 768px / 1024px: existing centered single-stage composition, external rail and aligned caption/offer overlays.
- [ ] Phones 320/360/390/430px iPhone Safari normal/enlarged text: no regression to mobile post viewer, footer clipping, rail overlap or extra Search.
- [ ] Safari/Chrome where transparency is reduced: panel becomes opaque and text remains readable.
- [ ] Keyboard: focus can reach the feed, creator, follow, all genuine post actions, captions, offer toggle and quick views.

## Real data and behavior
- [ ] Single API-backed post per snap, correct media (contain not crop), correct native autoplay/muted behavior and horizontally swipable media.
- [ ] One authentic post creator, one set of action handlers, exact API-backed engagement counts, verified indicator only when verified.
- [ ] Like, save, follow failure states still roll back.
- [ ] A real service/product attached to the visible post opens its original OfferQuickView with its real title/price and analytics; no duplicate offer entry.
- [ ] All three For You / Nearby / Connections tabs, Live, Stories and direct Create route work.
- [ ] Feed scroll, pagination, retry, impression/watch events remain operational.
- [ ] Browser console/network errors are reviewed on the released SHA, and the SHA is verified in Vercel.
- [ ] No unauthorized payment, onboarding, Agent or backend effects.

## Evidence rules
CI + local read-only Chromium smoke verify source/build/public shell only. Signed-in feed visual and interaction acceptance is **not** covered by those checks; owner release and desktop/Safari real-device verification are required.

## Owner-requested density follow-up — unverified until deployment
- [ ] Wide desktop (>=1120px, >=650px high): attached real service/product cards initially visible directly after caption/tags, with no long empty gap above the dock.
- [ ] Desktop toggle can collapse and re-expand those cards without duplicates or changed prices; accessible `aria-expanded` stays correct.
- [ ] Desktop context with a long caption and 3+ genuine offers scrolls as **one panel**; no nested scrollbar, inaccessible lower CTA or overflow under panel border.
- [ ] Tablet/phone / 200% browser zoom: offers start collapsed, existing overlay behavior and compact rail are unchanged.
- [ ] Resize from desktop to phone and back: offer disclosure resets appropriately, without obstructing media or restoring Search duplication.
- [ ] Light/dark/reduced transparency: price, offer titles and buttons retain contrast.
- [ ] No synthetic offer cards, mock amounts, API changes or transaction-state changes.
