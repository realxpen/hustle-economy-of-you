# Hustle UX004-A1.4 — Integration QA and Visual Review

**Status: post-fix Waydroid acceptance 5/5 PASS (owner-reported), physical Android acceptance PENDING.** The latest Expo APK succeeded, but A1 is not signed off until phone testing.
**Review date:** 2026-10-20
**Theme:** UX004-ADR-001, **Hybrid — dark immersive Feed / future Live and warm cream/light utility screens**.
**Baseline:** #146 (A1.1), #147 (A1.2), #148 (A1.3) are merged; each had green free GitHub cloud Android checks. This document proposes **A1.4 verification** for their integration, not an already tested APK.
**Latest A1 test build:** Expo demo APK [189f1447-93f9-4d63-b331-f38a7125a9f9](https://expo.dev/accounts/xpen/projects/hustle/builds/189f1447-93f9-4d63-b331-f38a7125a9f9), successful Android internal distribution build, Git commit `2444ac6252cbae3280bfa873e6f0589af45534e0`. Owner installed this updated APK in Waydroid and reported five passes. Physical Android installation/testing still pending.

## 1. What the current evidence proves

- **Code-level integration:** Offline demo imports the approved Hybrid color/spacing/type layer and uses four root tabs plus a distinct Create action; preserves local fake creators, likes, saves, comments, and search/filter.
- **Cloud compiled:** A1.3 main integration inherits the successful PR #148 native Gradle build and Mobile/Foundation CI. A1.4 must run exact-head checks again on its new PR.
- **Actual device evidence:** The owner previously installed and successfully launched the pre-UX004 offline Android APK (Expo build `90abbf94-0b2c-4f2d-92d3-b6d12050d13c`) and marked the original seven interactive smoke tests complete. The phone photo is a baseline, **not a screenshot of A1.1–A1.4**.
- **Visual review limitation:** One screenshot was captured from **Waydroid running on the owner's computer**, not a physical handset. It documents two layout defects in the pre-#150 APK; it does not verify a post-fix APK, comments/keyboard, hardware Back, touch performance, or phone stability. Mark those tests **PENDING**, not green.
- **Release limitation:** A GitHub job that queues `eas build --no-wait` is *not* a completed APK; inspect the actual Expo EAS status if the owner later approves a build.

## 1A. Waydroid screenshot review (owner image, 2026-10-20; environment confirmed)

**Evidence received:** one **Waydroid Android container screenshot** from the owner's Linux computer—not an emulator screenshot from Android Studio and **not a physical-phone screenshot**—of the dark For You Feed, with sample creator Mira Styles, booking offer, right action rail and lime-active five-item capsule. Waydroid displayed the portrait activity within a wider landscape desktop environment; black side margins are expected letterboxing and are **not** a validated app styling defect. This is not proof that ordinary portrait phone layouts fail.

**Visible and provisionally acceptable:** cream/lime actions on the charcoal capsule are legible; the creator, offer and illustrated-content disclosure are visible. The updated design foundation is appearing, but full A1 device QA is still pending.

**Visible defects requiring a separate reviewed fix:**
1. The floating “INTERACTIVE DEMO · FICTIONAL CONTENT” chip covers the top of the “MADE TO” poster headline on the screenshot. Its placement at `insets.top + 113` conflicted with `posterType.top = 17%` of card height.
2. Below the floating navigation capsule, the screenshot shows a sliver of the following Feed card / repeated wordmark at the bottom of the Android content viewport. The Feed card used `useWindowDimensions().height` for `pageHeight` rather than a measured FlatList viewport; the two can differ when Android letterboxes a portrait activity or reserves system bars.

**Corrective change merged in PR #150:** use `FlatList.onLayout` to measure its real viewport, apply the same page height to card layout, paging offsets and scroll position, and remount the list only when its measured height changes. Anchor poster headline at `insets.top + 164`, leaving a nominal 51dp band below the badge anchor. PR #150's native build passed. **A new APK must be installed into Waydroid to verify either visual fix**; merging code does not update the APK already installed. A later physical-phone smoke test remains a separate gate.

**Latest evidence:** Owner-reported post-#150 **Waydroid 5/5 PASS**, including headline overlap, Feed height, Feed navigation, Android Back, Hybrid theme. No updated screenshot independently reviewed yet; full physical Android device acceptance, exact-keyboard behavior on handset, 7/7 regression and >=10-minute stability remain pending. Do **not** mark A1 complete based solely on Waydroid results.

## 1B. Updated Waydroid QA result — 2026-10-20

**Environment:** Waydroid on the owner's Linux computer, updated Hustle APK from Expo build `189f1447-93f9-4d63-b331-f38a7125a9f9` (`2444ac6`, profile `demo`, Expo status **Succeeded**). This build includes merged PRs #146–#151, including the #150 visual fixes.

**Owner submitted five independent PASS results:**

| Waydroid check | Reported outcome |
|---|---|
| Demo badge no longer overlaps “MADE TO” headline | PASS |
| Next Feed card no longer bleeds below floating navigation | PASS |
| Feed swipes / switching Home and Explore | PASS |
| Android Back interaction | PASS |
| Dark Feed / cream utility Hybrid theme | PASS |

**Summary: Waydroid 5/5 PASS, user-reported.** The assistant did not run or observe these gestures directly, and no post-fix screenshot has yet been independently inspected. This evidence is sufficient to move the QA process to physical Android testing, but **not** to close A1.

**Physical handset required:** install the **same exact APK** on a real Android phone, verify 7/7 legacy features, layout, keyboard-first Back with comments draft, collections and offer restrictions, safe areas (gesture or 3-button mode), airplane-mode offline behavior, and >=10-minute crash-free use. Record pass/fail plus any reproduction steps; physical sign-off remains **PENDING**. No additional EAS build is required for the phone test.

## 2. New in A1.4

- Add `apps/mobile/scripts/ux004-a14-integration-audit.cjs`: read-only, standard-library validation of theme contrast and semantic surfaces, accurate offline disclosure sizing, tab order and Create semantics, compact widths (320/360/390/430 dp), navigation preservation, keyboard/sheet ownership, no API or production access and the manual Free APK gate.
- Run the audit in Mobile Cloud CI and in the existing *manual* Android build preflight; it prints an explicit **automated readiness is not phone acceptance** warning and writes summary evidence to GitHub CI.
- Fix three specific readability issues found by code inspection, without rearranging the known working interface: illustrated-content disclosure from 10→12sp, detail “fictional/no availability” notice from 12→13sp, and “NO BACKEND / NO TRANSACTIONS” notice from 10→12sp. These do not certify all other artwork overlays. Poster/rail typography and actual video are deferred to A2.
- No new dependency, animation, Supabase read, external media, backend calls, migrations or EAS build.

## 3. Acceptance matrix (A1 specification DS-01..BUILD-02)

Use **AUTOMATED**, **MANUAL PENDING**, **PASS** or **FAIL**. Do not mark device steps PASS based on scripts alone.

| ID | Check | Evidence required | Current status before new device build |
|---|---|---|---|
| DS-01 | Hybrid dark Home + cream Explore/Inbox/You/sheets | code role audit, four real-device screen captures | AUTOMATED; MANUAL PENDING |
| DS-02 | >=4.5:1 small text and >=3:1 large/control contrast | semantic token audit, actual poster/scrim and sheet image review | AUTOMATED solid token pairs; MANUAL PENDING photo overlays |
| DS-03 | Important labels not clipped at larger text scale | font-size audit + Android normal/large-text screenshots | AUTOMATED critical label sizes; MANUAL PENDING |
| DS-04 | Nav primary touch targets >=44–48dp | static layout math + real touch at narrow width | AUTOMATED; MANUAL PENDING |
| NAV-01 | Five visible slots in fixed order; four real tabs | source/CI proof and device screenshot | AUTOMATED; MANUAL PENDING |
| NAV-02 | Create remains a demo-only, unselected action | tap Create on each tab; no permission, publish or server call | AUTOMATED; MANUAL PENDING |
| NAV-03 | Feed index, search/category, likes/saves/comments retained | navigate and return after edits | AUTOMATED source contract; MANUAL PENDING |
| NAV-04 | Keyboard Back first; sheet Back then root Back | physical Android hardware/gesture Back in comments and Explore | AUTOMATED source guard; MANUAL PENDING |
| NAV-05 | System bars, nav pill, offer, lower cards never collide | 3-button + gesture modes, short screen screenshots | AUTOMATED layout arithmetic; MANUAL PENDING |
| NAV-06 | Modal interaction and focus; underlying nav not tappable | tap outside/scrim, close, IME, reply composer tests | AUTOMATED source guard; MANUAL PENDING |
| DEMO-01 | Fictional/disabled publishing, Live, payments, bookings disclosed | inspect all screens; airplane mode; no real requests | AUTOMATED offline contract; MANUAL PENDING |
| DEMO-02 | Original 7/7 demo interactions still work | repeat owner physical-device checklist | MANUAL PENDING |
| BUILD-01 | TS/Metro, single React, Expo versions, Gradle | exact-head GitHub Mobile/Foundation/native runs | PENDING new A1.4 CI |
| BUILD-02 | Finished new APK installs, runs >=10 min without crash | Expo actual build result, Android launch/QA and crash log | MANUAL PENDING, no build authorized |

## 4. Waydroid preflight and physical-phone QA (after **separate** build approval)

**Install:** Owner explicitly approves use of **one** Expo Free-tier Android demo allowance only after review/merge and exact-head CI. Open the existing manual GitHub workflow on main, tick its `approve_free_demo_build` checkbox, and inspect the returned Expo build page. Only when EAS status is **Finished**, download/install the new APK in **Waydroid first**, retest badge/headline and Feed viewport, and retain the previous build as rollback. Then install/test on a physical Android phone for final acceptance. Neither a merged PR nor GitHub's EAS queue success proves the new APK was built or installed. Never publish to Play Store.

**Visual evidence — 5 captures:** capture *new Waydroid screenshots first*, clearly labelled **Waydroid / build ID**, followed by *actual physical-phone screenshots* for final acceptance, **not** a photograph of the damaged display, if Android allows it. Screenshots should be (a) dark For You Feed with offer/nav, (b) cream Explore with keyboard closed and skill filter, (c) cream You with collections, (d) cream Inbox, (e) light Comments sheet with the keyboard open (redact personal keyboard suggestions/notifications). Show 3-button or gesture system navigation in at least one. Screenshots pending.

**Interaction script:**
1. Open Hustle cold. Wait 30s. Capture Feed; swipe three posts. Check labels/offer card/nav fit without clipping.
2. Feed → Explore → change category and type a search → dismiss keyboard with Android Back → re-open Explore later and ensure text/category remain.
3. On Explore, Android Back should return Home and retain original feed position.
4. Open comments on a post; type without sending. First Android Back should hide keyboard, next should close the sheet. Repeat using Close and scrim.
5. Open sheet with keyboard hidden; press Send after writing a *demo* comment; verify thread and that no real network persistence is implied.
6. Save post to Inspiration, return to You and open collection; navigate away and return to normal Feed position. Like/follow and switch tabs; state should survive the session.
7. Tap center Create and LIVE. Neither may claim real publishing or a real broadcast, request phone permissions, or send content.
8. Open offer and sample booking. Confirm zero real availability, money movement, saved booking, verified provider or server request.
9. On Inbox and You, scroll/inspect lower content and nav overlap. Change Android font size once, if feasible; validate labels remain readable.
10. Navigate for >=10min; background/resume and enable airplane mode; verify no crash. If crash occurs on Ubuntu with USB debugging, run `adb logcat -b crash -d -v brief | tail -n 100`, redact any personal info and attach it to QA.

**Waydroid pass** requires a newly installed post-#150 APK and recorded build ID showing both visual fixes; **full A1 pass** additionally requires an actual physical-Android phone walkthrough and owner evidence. A Waydroid screenshot cannot prove touch, performance, OEM keyboard behavior, or physical-device stability. Record both environments, Android versions and observed failures.

## 5. Visual defects / risks known from static review

- The current Home screen still uses illustrated sample posters, not real work video. **Intended A2**; don't score A1 on real playback or claimed Live.
- The Feed uses absolute overlay positioning and some 10–11sp decorative labels; real-device font scaling and legibility are **not verified** and may need later A2 fixes. A1.4 only increases explicitly critical fictitious-content and no-transaction text.
- RN Android IME and Modal behavior can vary by device/OS; successful TS/Gradle cannot prove Back/keyboard ordering. **Block A1 sign-off on physical tests**, don't silently assume it.
- The You collections share a saved-posts preview, not a fully persistent per-collection server-backed store. That is offline demo behavior, **not** a connected marketplace feature.
- No web/Android video/media rights, AI, payments, escrow, posting, persistent identity or geographic proximity are activated.

## 6. Sign-off and handoff

| Gate | Evidence | Reviewer / outcome |
|---|---|---|
| A1.4 code PR reviewed | GitHub diff, no restricted files touched | Owner — PENDING |
| Free CI checks green | latest GitHub Mobile, Foundation, Native Gradle jobs | PENDING |
| Expo build quota approved separately | explicit owner decision, manual GitHub Action only | NOT APPROVED by this document |
| New APK Finished | Expo build result, not GitHub workflow success | PENDING |
| Waydroid post-fix functional retest | owner-tested updated APK, Feed badge/viewport, Feed navigation, Android Back and Hybrid theme | **PASS 5/5, owner-reported**; updated screenshot optional verification |
| 5 physical-phone captures and 7/7 regression | phone evidence, comments keyboard/back, nav, disclosures | PENDING |
| Stable real Android smoke | >=10min, offline/background and Back checks | PENDING |
| UX004-A1 fully accepted | all gates above PASS, owner signs off | PENDING |

**Next milestone after sign-off:** UX004-A2 Feed and Social Interaction Experience Upgrade. Do not begin rollout or claim that a live marketplace is activated on the basis of this offline UI.

**Safety:** No production database/credentials, new dependencies, paid services, new staging, real bookings, payments, escrow, deployment or automatic EAS builds.
