# UX004-A1.1 — Hybrid Design Foundation Implementation Evidence

**Status:** Review branch; runtime proof on physical Android still pending.
**Owner design decision:** UX004-ADR-001 — dark immersive Feed/future Live, cream/light utility and detail screens; locked 2026-10-20.
**Spec:** [UX004-A1](../UX/HUSTLE_UX004_A1_DESIGN_SYSTEM_NAVIGATION_SPEC.md).

## Delivered in this review slice
- New typed token exports under `apps/mobile/src/ux004/theme/`: semantic approved colors (including accessible #536159 secondary on paper), spacing, radius, typography, layout/tap targets. Does not globally switch theme.
- Reusable `HybridScreenSurface`, `AppIcon`, `TactilePressable`, `DemoDisclosure`, `SurfaceCard`, `ScreenHeader`, `EmptyState` in `apps/mobile/src/ux004/components/`. All use currently installed native/Expo dependencies; no external assets.
- Offline `DemoExperience` imports theme roles and starts using `HybridScreenSurface`, `AppIcon`, `TactilePressable` for existing primary buttons and `DemoDisclosure` for the fictitious-content chip. Existing fake data and flow unchanged. The mode screen switches dark Feed / cream utility. Footer/nav is **not** rewritten in A1.1.
- Add `apps/mobile/scripts/ux004-a11-contract.cjs` to read-only Mobile Cloud CI and inside manual Android demo preflight before EAS queue; verifies token pairing contrast, demo integration and preserved React resolver/auth flag contract.

## Changes deliberately deferred
- FloatingTabBar/controller/Android Back and keyboard architecture → A1.2/A1.3.
- Feed media, attachment layout and comments redesign → A2.
- Search, creator profiles and genuine service/product pages → A3/A4.
- Any real backend, real booking, availability, payments, escrow, authentication, storage, creator posting, or Live → outside A1.
- No new APK requested; GitHub Action succeeds at **queueing** only, not install acceptance.

## Non-regression checklist before owner merge
- [ ] Exact-head Mobile Cloud CI green, including UX004-A1.1 contract, React singleton, TypeScript, Metro and native autolinking.
- [ ] Exact-head Foundation CI green on pinned Ubuntu 24.04; existing browser tests preserved.
- [ ] Free GitHub Android native Gradle diagnostic green where triggered.
- [ ] GitHub file diff contains only `apps/mobile/src/ux004/*`, demo-only experience edits, test script, read-only CI/manual EAS safeguards and this QA note. No production environment or data changes.
- [ ] Review approved theme and accessibility pairs in PR.

## Owner physical-Android check after a separately approved APK build
- Existing seven interactions: feed swipe; For You/Nearby; like/comment/reply; save collections; explore/profile; offer/booking **preview**; Home/Explore/Inbox/You.
- Additional checks: dark Feed, cream Explore/Inbox/You, clear disclaimer text, readable small text, background/resume, keyboard/back, and 10-minute crash-free run.
- Never interpret a successful TypeScript/Metro/Gradle result as a passed visual/real-device test.

**Rollback:** keep the previously working Android demo APK and the Expo SDK54 / mobile React 19.1 resolver untouched.
