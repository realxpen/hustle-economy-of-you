# Hustle UX004-A2.3 — Feed offer hierarchy and illustrated media fallback

**Date:** 2026-10-21
**Device acceptance: PENDING.** The owner currently cannot use Waydroid/the Android emulator. This work is source-reviewed and cloud-tested only; **No Expo build** was approved, triggered or consumed.
**Baseline:** A1 fictional offline demo accepted (Waydroid 5/5, phone 7/7). A2.1 PR #153 and A2.2 PR #155 merged with green native Gradle checks. Those earlier phone tests do **not** certify A2.

## What changed

- The post-attached offer card now visibly distinguishes **SAMPLE SERVICE** from **SAMPLE PRODUCT**, using the correct type of item from the existing fictional post.
- Feed actions now say **View service** / **View product** in the accessible label, not Book/Shop. Tapping opens the *same existing sample offer detail sheet*, which retains the existing preview-only booking or disabled checkout path.
- The offer card uses stronger hierarchy: sample category, offer title (up to two lines), fixture price, and a simple **View ↗** affordance on the right. It uses the existing approved dark/lime palette and at least the shared 48dp target.
- Fallback posters retain the exact A1 measured-viewport positioning and artwork. The small artwork provenance label is now **ILLUSTRATED DEMO · [category]** at 12sp. The lower **Illustrated sample, not real video** notice stays in place.
- No photo/video asset is introduced. No video player, Play icon, Live simulation, fake verified badge, stock claim, actual location check or authentic transaction is implied.

## Implementation

- `apps/mobile/src/ux004/feed/demoOfferCopy.ts` — small pure, typed service/product copy selector, tested with real executable helper assertions.
- `apps/mobile/src/ux004/feed/FeedOfferAttachment.tsx` — presentational accessible card; no networking, stateful commerce, dependency, payment or booking action. Receives only local fixture kind/title/price/creator plus an existing preview callback.
- `DemoExperience.tsx` wires card to existing `open("offer", post)`, leaves modal detail, React state, all interactions and safe areas intact, and makes the poster label explicit.
- `apps/mobile/scripts/ux004-a23-offer-contract.cjs` checks pure copy, labeling, minimum target size, source binding, no external data, A1/A2 preservation and manual Expo gating. Runs in Mobile CI and **only preflights** the unchanged manual build action.

## Automated acceptance

- [ ] A2.3 pure-copy and UI contract PASS.
- [ ] A1, A2.1 and A2.2 guards PASS; TypeScript and offline Android Metro PASS.
- [ ] Foundation CI PASS.
- [ ] Free native Android Gradle diagnostic PASS.
- [ ] Owner reviews and merges PR; no automatic merge.
- [ ] No new APK or production deployment.

## Deferred device QA — only when access returns

| Test | Expected |
|---|---|
| Service post (fashion/barber/photographer) | Card shows **SAMPLE SERVICE**, its original sample price and "View ↗" |
| Product post (chef) | Card shows **SAMPLE PRODUCT**, its original sample price and "View ↗" |
| Open service offer | Same sample service detail and booking **preview only**, never submits |
| Open product offer | Same product detail and disabled checkout, never purchases |
| Media fallback | No pretend video playback; visible 12sp ILLUSTRATED DEMO label and sample warning |
| 320dp / short-height / large font | Two-line title does not collide with rail, caption, demo banner, nav or Android gesture area |
| Swipe / double-tap / comments / named collections | Prior A2.1–A2.2 interactions work without accidental offer presses |
| TalkBack | Card announced as service/product preview, with creator, price and "no booking/purchase" hint |
| Offline mode and >=10min session | No real calls, sign-in, booking, uploads, payment or crash |

**Current A2.3 phone/Waydroid result:** PENDING. A passing TS/Metro/Gradle build does not establish layout, tap feel, screen-reader behavior or stability on physical Android.

## Deferred work

- Future real work-video feed requires appropriate licensed/user-provided media and separate explicit authorization; no demo assets are invented here.
- UX004 A2.4 will aggregate completed Feed/social slices and prepare a controlled visual QA and **separately approved** Android build, not an automatic release.
- The approved scope remains an offline fictional preview; connected Hustle commerce and any production payments/escrow are separate projects and gates.
