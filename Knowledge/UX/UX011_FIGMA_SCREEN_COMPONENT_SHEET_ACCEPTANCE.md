# UX011 — Figma Mobile V1 screen, component and popup integration

Status: Implementation PR; review and device acceptance pending
Design: https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s/Hustle-%E2%80%94-Mobile-Experience-V1?node-id=0-1
Dependency: UX004 Hybrid direction and ADR-0071; preserves real source/capability gates.

## Delivered in this milestone
- Added dependency-free native SheetChrome and SkillChip primitives; upgraded shared ScreenHeader and SurfaceCard.
- Aligned **real connected and offline demo** Explore title and category/result chip behavior to common visual styles. Selection state, search callback and API boundaries stay unchanged.
- Replaced divergent native sheet headers with one accessible 48dp Close and grabber system for comments/replies, saves, shares, creator, attached offers, booking and opportunity preview.
- Connected popups now scroll inside a keyboard-safe bounded sheet on smaller Android/iOS screens. Offline demo keeps its own keyboard-dismiss-then-close logic and fiction/nontransaction disclosures.
- Unified responsive CSS for Web/PWA Explore & Marketplace, public Hustler profile, service and product detail, service booking/consultation forms, Inbox, and the canonical real-data Offer Quick View popup.
- Offer Quick View is a **warm light bottom sheet** over the dark media Feed, with proper safe-area, scroll boundary, dark contrast and lime CTA. It retains its focus trap, Escape key, backdrop dismiss, data loading/retry and existing offer links.
- No modifications to API models, payments/escrow, identity, database, sign-in, Live backend, or production deployment.

## Acceptance matrix — required before external tester release
| Area | Design check | Functional check |
|---|---|---|
| Feed + linked offer | Dark immersive, CTA visible above dock; no overlay on 320/360/390px | Real work media, feed paging, creator and offer opens |
| Explore / Marketplace | Cream utility, input + chips + cards, 44–48px controls | Search, filter, pagination; don't invent people/locations |
| Hustler profile | Cover/identity, skills, real offers, work-first hierarchy | Follow/message/services; verified/reviews only when sourced |
| Service / Product | White detail card, rich imagery, provider identity, CTA | Current API price, availability, products; no fake checkout |
| Booking | White form, readable hints, date/slot and review | Live slot read, draft persistence, explicit booking boundary |
| Connected native sheets | Rounded cream sheet, bounded height and close control | Correct post/offer context; dismiss, Back, keyboard, nested lists |
| Offline native demo sheets | Same chrome, session-only content labelled | Safe synthetic operations, no network or transactions |
| Web offer quick view | Desktop popup + mobile bottom sheet, real media | Focus trap, Escape, scroll, retry, correct deep link |
| Inbox | Readable cards, search, unread state | Genuine conversations; no manufactured messages |

Required device matrix: Android 320–430dp, installed iPhone PWA + Safari 320/360/390px, tablet 768px, desktop 1440px; normal/increased font sizes, screen reader, modal keyboard, focus, Back and empty/error/loading. CI source contracts and build checks are **not** screenshot approval. Do not merge/deploy purely because CSS token checks pass.
