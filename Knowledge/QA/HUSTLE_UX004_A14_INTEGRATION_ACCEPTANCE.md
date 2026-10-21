# Hustle UX004-A1.4 — Integration QA and Visual Review

**FINAL UX004-A1 STATUS (2026-10-21): ACCEPTED for the offline demo on owner-reported functional QA.** Waydroid **5/5 PASS**; physical Android **7/7 PASS, 0 FAIL, 0 NOT TESTED**, including the final offline-safety gate. This is not an independently observed multi-device certification or a live-marketplace production release.
**QA window:** 2026-10-20–2026-10-21; **owner sign-off recorded:** 2026-10-21
**Theme:** UX004-ADR-001, **Hybrid — dark immersive Feed / future Live and warm cream/light utility screens**.
**Baseline:** #146 (A1.1), #147 (A1.2), #148 (A1.3) are merged; each had green free GitHub cloud Android checks. This document proposes **A1.4 verification** for their integration, not an already tested APK.
**Latest A1 test build:** Expo demo APK [189f1447-93f9-4d63-b331-f38a7125a9f9](https://expo.dev/accounts/xpen/projects/hustle/builds/189f1447-93f9-4d63-b331-f38a7125a9f9), successful Android internal distribution build, Git commit `2444ac6252cbae3280bfa873e6f0589af45534e0`. Owner installed this updated APK in Waydroid and on a physical Android phone, reported **5/5** and **7/7** functional passes respectively, and confirmed the final offline-safety retest **PASS**.

## 1. What the current evidence proves

- **Code-level integration:** Offline demo imports the approved Hybrid color/spacing/type layer and uses four root tabs plus a distinct Create action; preserves local fake creators, likes, saves, comments, and search/filter.
- **Cloud compiled:** Reviewed A1.1–A1.4 PR checks passed, including the #150 native Gradle diagnostic. The owner-approved demo workflow [run #39428884874](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39428884874) queued the final approved APK at exact commit `2444ac6`; Expo separately reported **Succeeded**.
- **Actual device evidence:** The owner previously installed and successfully launched the pre-UX004 offline Android APK (Expo build `90abbf94-0b2c-4f2d-92d3-b6d12050d13c`) and marked the original seven interactive smoke tests complete. The phone photo is a baseline, **not a screenshot of A1.1–A1.4**.
- **Visual review provenance:** The pre-#150 defect screenshot was captured in **Waydroid on the owner's computer**, not a physical handset. The owner later reported that the same two layout defects were resolved on the new APK in Waydroid and on physical Android. No new screenshots, device metadata, system logs or independent gesture recordings have been submitted.
- **Release evidence:** A GitHub job that queues `eas build --no-wait` is not itself a finished APK. Here Expo [build 189f1447](https://expo.dev/accounts/xpen/projects/hustle/builds/189f1447-93f9-4d63-b331-f38a7125a9f9) separately reported **Succeeded** (SDK 54, Android internal-distribution APK, `demo` profile); owner reported installing and testing it in both environments.

## 1A. Waydroid screenshot review (owner image, 2026-10-20; environment confirmed)

**Evidence received:** one **Waydroid Android container screenshot** from the owner's Linux computer—not an emulator screenshot from Android Studio and **not a physical-phone screenshot**—of the dark For You Feed, with sample creator Mira Styles, booking offer, right action rail and lime-active five-item capsule. Waydroid displayed the portrait activity within a wider landscape desktop environment; black side margins are expected letterboxing and are **not** a validated app styling defect. This is not proof that ordinary portrait phone layouts fail.

**Visible and provisionally acceptable:** cream/lime actions on the charcoal capsule are legible; the creator, offer and illustrated-content disclosure are visible. The updated design foundation is apparent in the pre-fix screenshot; later owner-reported post-fix Waydroid 5/5 and physical Android 7/7 results supersede this initial observation.

**Visible defects requiring a separate reviewed fix:**
1. The floating “INTERACTIVE DEMO · FICTIONAL CONTENT” chip covers the top of the “MADE TO” poster headline on the screenshot. Its placement at `insets.top + 113` conflicted with `posterType.top = 17%` of card height.
2. Below the floating navigation capsule, the screenshot shows a sliver of the following Feed card / repeated wordmark at the bottom of the Android content viewport. The Feed card used `useWindowDimensions().height` for `pageHeight` rather than a measured FlatList viewport; the two can differ when Android letterboxes a portrait activity or reserves system bars.

**Corrective change merged in PR #150:** use `FlatList.onLayout` to measure its real viewport, apply the same page height to card layout, paging offsets and scroll position, and remount the list only when its measured height changes. Anchor poster headline at `insets.top + 164`, leaving a nominal 51dp band below the badge anchor. PR #150's native build passed. **The updated APK was subsequently installed in Waydroid and on the owner's physical phone**, and the owner reported both fixes passing. Merging code alone would not have updated the prior installation.

**Final evidence:** Owner-reported post-#150 **Waydroid 5/5 PASS** and **physical Android 7/7 PASS**, including keyboard/Back, interaction state, offline-safety disclosures and stability/screen-fit. No updated post-fix screenshot, exact phone model/Android version or independent runtime log was submitted. Acceptance is based on owner QA, not Waydroid alone.

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

**Summary: Waydroid 5/5 PASS, user-reported.** The assistant did not run or observe these gestures directly, and no post-fix screenshot has yet been independently inspected. This was the Waydroid-only intermediate gate. Physical Android QA subsequently passed 7/7 and the owner accepted the offline-demo milestone.

**Physical handset follow-up (completed, owner-reported):** the owner installed this same APK and marked the seven grouped functional checks PASS, including the final airplane-mode/LIVE/Create/booking/product safety test on 2026-10-21. Exact phone model/OS, screenshots and raw 10-minute timing/log evidence were not supplied. No additional EAS build is needed for UX004-A1.

## 1C. Physical Android QA results — owner submission

**Tested artifact:** Same successful Expo build `189f1447-93f9-4d63-b331-f38a7125a9f9` (`2444ac6`) previously tested in Waydroid. **Environment:** physical Android handset (model and Android version not supplied). These are **owner-reported pass/fail observations**, not independently observed tests.

| Physical Android check | Owner outcome | Acceptance note |
|---|---|---|
| App launches | PASS | No launch failure reported |
| Feed layout | PASS | Previous badge/headline overlap and Feed-height issue no longer reported |
| Swiping and navigation | PASS | User reports Feed and tab navigation working |
| Social interactions | PASS | User reports offline like/comment/save/etc. interaction working |
| Android Back and keyboard | PASS | User reports comments keyboard and Back flow working |
| Offline safety | **PASS (final owner submission 2026-10-21)** | Airplane mode, disabled LIVE/Create, preview-only booking, and disabled product checkout all reported as expected |
| Stability and screen fit | PASS | Owner reports stability/layout working; exact session duration, airplane-mode check, screenshots and logs not individually supplied |

**Final result: 7 PASS, 0 FAIL, 0 NOT TESTED (100% of the owner-reported seven-item functional checklist).** The first submission was 6/7 with offline safety untested; the owner explicitly completed the targeted safety retest with **PASS** on 2026-10-21. No functional defect was reported. Raw screenshots, device/OS metadata and independently timed stability evidence remain uncollected; do not describe them as verified.

### Targeted safety retest — completed PASS (owner report, 2026-10-21)

1. With the **same APK installed on the phone**, turn on **airplane mode**. Open Home and Explore; the illustrative Feed and profiles should still work without network access.
2. Tap **LIVE** in the Feed header. Expected: `Live demo` alert explaining that livestreaming is not enabled; no camera/microphone livestream starts.
3. Tap the center **Create** button. Expected: `Create · Demo` alert explaining publishing is disabled; no upload, account creation, or real post.
4. Tap a post's service pill → **See sample booking** → **Preview request (not sent)**. Expected: illustrative time options and a confirmation explicitly stating the booking was not sent or saved and no payment was collected. No real booking/checkout/payment.
5. Tap a **product** offer → **View sample product options**. Expected: product-preview alert explaining shopping/checkout is disabled; no purchase.
6. Optionally reopen the app with the network still off and check that the interactions and visible fictional-content/no-transaction disclosures remain clear. Report **PASS** if all work as stated; otherwise **FAIL** and give which action and what appeared.

**Result:** The owner reported **PASS** for this exact five-step safety checklist on 2026-10-21, closing DEMO-01 for the offline demonstration. This is user-observed behavior, not proof of a network-packet audit. The next milestone is UX004-A2, not activation of a real marketplace.

## 1D. Final A1 acceptance decision — 2026-10-21

- **Scope accepted:** UX004-A1 Hybrid UI and demo navigation on the **fictional, offline Android APK** only. A1.1 semantic theme, A1.2 floating four-tab navigation + Create action, A1.3 Android Back/keyboard and safe-area handling, A1.4 integration/disclosure/readability checks and PR #150 viewport/headline corrections.
- **Owner QA results:** Waydroid on Linux **5/5 PASS** (reported 2026-10-20); physical Android **6/7 PASS, one untested** initially, followed by explicit **offline safety PASS** on 2026-10-21: final **7/7 PASS, 0 FAIL**. No observed defect remained open in these grouped tests.
- **Exact accepted artifact:** [Expo Android demo APK `189f1447-93f9-4d63-b331-f38a7125a9f9`](https://expo.dev/accounts/xpen/projects/hustle/builds/189f1447-93f9-4d63-b331-f38a7125a9f9), commit `2444ac6`, `demo` profile, Android internal distribution; status **Succeeded**.
- **Code/CI evidence:** PRs #146–#151 merged; Mobile/Foundation cloud validations green, #150 native Android Gradle green. Documentation PR #152 records final user acceptance; **do not merge it automatically** without separate owner action.
- **Known evidence limits:** phone brand/OS, five planned physical screenshots, a fresh post-fix Waydroid screenshot and raw 10-minute logs/timing have **not** been provided. The owner marked the stability/screen-fit test PASS, but no independent instrumentation was run. These are **follow-up documentation/device-coverage opportunities**, not unreported failures.
- **Out-of-scope:** production launch, real user accounts/identity, real video or LIVE, publishing, messaging, Supabase/backend integration, escrow, wallets, checkout, bookings or payment authorization. These remain disabled or unconnected in the offline demo. **Do not interpret A1 acceptance as production security certification.**
- **Decision:** **ACCEPT UX004-A1 as complete for the offline interactive prototype based on the owner's reported acceptance checks.** Begin planning UX004-A2 Feed and Social Interaction Experience Upgrade as a separate reviewed change. No build or production rollout is authorized by this decision.

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
| A1.4 and Feed correction PRs | Reviewed/merged PRs #149 and #150; QA correction #151 merged | COMPLETE |
| Free CI checks green | A1.4 Mobile/Foundation passes and PR #150 Mobile/Foundation/Native Gradle passes | PASS |
| Expo build quota approved separately | owner explicitly approved one manual demo build; GitHub run #39428884874, commit `2444ac6` | APPROVED AND QUEUED ONCE |
| New APK Finished | [Expo 189f1447](https://expo.dev/accounts/xpen/projects/hustle/builds/189f1447-93f9-4d63-b331-f38a7125a9f9), succeeded | PASS |
| Waydroid post-fix functional retest | owner-tested updated APK, Feed badge/viewport, Feed navigation, Android Back and Hybrid theme | **PASS 5/5, owner-reported**; updated screenshot optional verification |
| Physical-phone functional checklist | Owner report on exact APK: launch; Feed layout; navigation; social interactions; Back/keyboard; offline safety; stability/screen fit | **PASS 7/7, FAIL 0, NOT TESTED 0** |
| Stable real Android smoke | Owner marked the combined stability/screen-fit and Back checks PASS; raw timing, logs and phone metadata not supplied | **OWNER-REPORTED PASS**; detailed instrumentation not verified |
| UX004-A1 offline-demo milestone | Waydroid 5/5 + phone 7/7 + final DEMO-01 pass, owner acceptance | **ACCEPTED 2026-10-21 (owner-reported QA); non-production only** |

**Next milestone:** UX004-A2 Feed and Social Interaction Experience Upgrade. UX004-A1 is accepted only as an **offline demonstration**; do not start a connected-marketplace rollout or claim real transactions are supported.

**Safety:** No production database/credentials, new dependencies, paid services, new staging, real bookings, payments, escrow, deployment or automatic EAS builds.
