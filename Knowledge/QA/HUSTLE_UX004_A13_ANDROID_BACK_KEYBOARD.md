# UX004-A1.3 — Android Back, Keyboard and Safe-Area QA

**Owner-approved UX004-A1 spec:** [A1 Design System and Navigation](../UX/HUSTLE_UX004_A1_DESIGN_SYSTEM_NAVIGATION_SPEC.md).
**Baseline:** PR #147 merged and the free native Gradle build passed. Physical device has passed the earlier 7/7 offline-demo smoke before A1.1/A1.2; do **not** imply this new code has been tested on hardware.
**Scope:** the fictional offline demo only. No packages, EAS build, paid service, production connection, auth, database, real publishing, booking or transaction.

## Code changes
- Add `useDemoAndroidBack`: keyboard show/hide listeners with cleanup and Android `hardwareBackPress` subscription with cleanup. While React Native Modal is open, the Modal retains ownership of Back via `onRequestClose`; the root handler defers to it.
- When no modal is open, hardware Back first dismisses the Android keyboard, otherwise moves Explore/Inbox/You → Home, preserving existing local demo interaction state. From Home, the native system can exit/background normally; no custom exit trap.
- Modal `onRequestClose`, scrim and close control now call `requestDismissSheet`: hide the keyboard first, then dismiss the sheet on the next action. Does not submit a comment or a booking.
- Comments sheet gets scrollable light content, `keyboardShouldPersistTaps="handled"` and `nestedScrollEnabled`; comment composer offers keyboard Send, an accessible 48dp Send control and minimum 48dp close control.
- You becomes a vertically scrollable utility page; Inbox reserves bottom space for the navigation capsule and top system inset. Nav capsule is hidden while the soft keyboard is open, then restored.
- Add `ux004-a13-android-back-contract.cjs` in Mobile Cloud CI and manual owner-gated Expo preflight. Preserve A1.1/A1.2, single-React resolver, SDK54 package pins and offline data.

## Intentional non-changes
- Expo and React/native dependency versions, root App, Metro resolver, authentication, Supabase, API and payment modules untouched.
- Existing five-item nav, Create alert, selected tab, For You/Nearby, comments, saves, Explore filters and booking-preview disclosure stay in place.
- Full feed overlay redesign/video playback remains A2; no paid or externally hosted demo media.
- No new Expo Free APK is queued; GitHub CI can compile code but cannot certify real touch/back behavior.

## Validation
- [ ] Exact-head Mobile Cloud CI green: SDK autolinking, React singleton, A1.1/A1.2/A1.3 contracts, TypeScript, Metro Android bundle.
- [ ] Exact-head Foundation CI green: 35-step build + browser smoke on Ubuntu 24.04.
- [ ] Exact-head free Android Gradle release diagnostic green.
- [ ] Owner PR review and merge.
- [ ] Later, **only with explicit owner approval**, one free Expo Android demo build plus real-device smoke.

## Real-device acceptance matrix
1. On Home with no sheet, Android Back uses the normal Android exit/background behavior, without a custom “Are you sure?” trap or app crash.
2. On Explore, Inbox or You, Android Back returns to Home and retains the Feed's last normal post and likes/saves.
3. On Explore search with keyboard open, the first Android Back dismisses the keyboard without discarding search text; the next Back returns Home.
4. On Feed, open Comments, type a draft and press Android Back: keyboard disappears; press Back again: sheet closes and returns to the same post, without submitting the draft.
5. With a Comments sheet open, use its explicit Close or scrim: first dismissal closes the keyboard (when open), a later dismissal closes the sheet.
6. Verify the Comments sheet scrolls and the Send control remains reachable and >=48dp on an older/small Android display, large font scale and 3-button navigation.
7. Verify Explore search does not have the floating nav over the keyboard; after keyboard dismissal, nav returns and has five touch targets.
8. On a short phone display, scroll the whole You page to reach its final disclosure and saved collection rows above the floating bar.
9. On Inbox, the centered message/CTA is visible and doesn't collide with either top status bar or floating bar.
10. In booking preview, hardware Back and sheet Close never submit a real booking, charge money or change any server.
11. Repeat original 7/7 owner tests, navigate for 10 minutes, foreground/background app and inspect any Android `adb logcat -b crash` if force-close occurs.

**Pass requires real-device observation**, not a green compiler alone. If nested scroll or keyboard behavior differs by Android OS/device, record the device, OS, exact steps and screenshot/log before altering the implementation.

## Rollback
Keep the known working Expo APK untouched. A1.3 is a reviewed PR, not a production release. Revert the A1.3 demo code and its standalone hook to the previously merged A1.2 state if a physical-device regression is found.
