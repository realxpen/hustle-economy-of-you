# Hustle UX004-A2.4 — Cumulative Feed & Social Integration QA

**Date:** 2026-10-21
**Device acceptance: PENDING.** Owner cannot currently access Waydroid / an Android emulator. This is **source-level integration QA + automated cloud validation**, not device acceptance. **No new Expo APK** is approved, requested or required.

## Baseline and purpose

- Accepted A1 offline fictional Android demo: prior owner-reported Waydroid 5/5 and physical phone 7/7. Keep that exact A1 APK as a rollback baseline, not as evidence of A2 approval.
- A2.1 (#153), A2.2 (#155) and A2.3 (#157) merged into main with green mobile/Android/cloud checks.
- A2.4 adds no user-facing feature: it tests these changes together and leaves the actual mobile rendering unverified until a device is available.
- Preserve UX004-ADR-001: immersive dark Feed; warm light utility surfaces; reversible, accessible controls.

## Automated contract (runs without a device)

The new apps/mobile/scripts/ux004-a24-integration-contract.cjs:
1. Reads the **actual literal post and comment fixtures** from DemoExperience.tsx using the TypeScript AST, refusing non-literal fixture expressions rather than executing arbitrary app code.
2. Transpiles and executes **the existing pure helpers** from demoSocial.ts and demoOfferCopy.ts with Node and locked TypeScript. No substitute implementation.
3. Validates four unique fictional posts, offer identity/type/copy, ₦ sample-price language, and nontransactional preview labels.
4. Simulates a nested local reply, verifies direct-root attachment and ordering, preserves independent post counts, and detects mutation of the initial comment fixture.
5. Verifies that Inspiration, Outfit ideas and the union of saved posts remain independent and in original Feed order, without mutating the post fixtures.
6. Guards UI wiring for double-tap additive Like, caption expansion, sample offer callbacks, saved-feed index restoration, Android Back/keyboard ownership, TalkBack labels, source disclosures and no connected commerce.
7. Confirms all four A2 cloud contracts run again as manual preflight **before** the owner-authorized Expo EAS command, which remains off by default.

**Limits:** Pure helper execution + source assertions do not demonstrate that the Android app renders without overlapping content, that TalkBack works, or that gestures feel right. Those are intentionally deferred.

## Deferred integrated device matrix (not run)

| Journey | Actual steps to perform after access returns | Expected / evidence |
|---|---|---|
| Feed paging | Scroll 4 fictional posts on narrow and normal portrait, return to previous posts | Only one page visible per swipe; no next-card bleed, original order/index preserved |
| Per-post Like/caption | Double-tap artwork, visit another post, return, use rail unlike; expand/collapse two different captions | Only correct post liked; double-tap cannot unlike; caption states independent |
| Comments/keyboard | Open comments, reply to existing reply, cancel reply, submit text; press Back once then again | New reply under root; draft preservation; keyboard dismisses before sheet |
| Save collections | Save fashion post in Inspiration, chef product in Outfit ideas, save a third to both | Each collection shows only its own posts; union/restoration correct; checked states read correctly |
| Offer service/product | Open each sample offer from Feed and Creator; tap illustrative booking/product controls | Matching title/price; service demo request not submitted; product checkout disabled |
| Navigation & disclosure | Move Home → Explore → Inbox → You → collection → Home; inspect every sheet | Hybrid theme/nav persist, fictional/offline notices never disappear |
| Accessibility & short screens | Test TalkBack, 320dp wide/short screen, enlarged text, gesture navigation | Labels distinguish view service/product and say no purchase/booking; offer/title/rail/nav do not overlap |
| Offline soak | Run in airplane mode for 10+ minutes; repeatedly navigate, comment, save and share | No authenticated session, real API/media, checkout, live call, crash or actual transaction |

For each test, later record **device/build hash, Android version, screen density, PASS/FAIL, screenshot or repro, and owner disposition**. A2.4 remains **PENDING** until that real acceptance occurs; cloud checks are a development gate only.

## Engineering boundaries

- No product UI changes, media assets, npm dependencies or lockfile changes.
- No new API, authentication, Supabase, payments, real bookings, escrow, Live or production deployment.
- No automatic Expo EAS trigger, private accounts, privileged secrets or Android device requirement.
- PR is for **owner review/merge**, never self-merge; future APK is a separately approved action.
- Next UX004 decision after this integration gate: either targeted visual polish based on real-device findings or a separately approved A2 Android preview build when the owner has a device.
