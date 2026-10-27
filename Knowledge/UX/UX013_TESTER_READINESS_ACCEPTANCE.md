# UX013 — Hustle tester-readiness acceptance

Status: **Implementation PR / guarded QA in progress**.
Product: Hustle — content-first skilled-services and creator marketplace.
Design target: https://www.figma.com/design/psxnn95X8nPqEEp7IvEw5s/Hustle-%E2%80%94-Mobile-Experience-V1?node-id=0-1

## Why this exists

Passing UX004/UX011 source contracts and the 25 public-shell screenshot checks from UX012 does **not** establish that the connected application is tester-ready. UX013 separates repeatable **guest synthetic** checks from genuine **two-user** device acceptance; real API data, bookings, content and payments must not be fabricated.

## Automated, safe and repeatable

Foundation CI now executes:
- Existing UX012 25-screen public shell capture at 320/360/390/768/1440 CSS px.
- Existing public Service → guest sign-in gate → draft-only Booking, with synthetic GET only.
- **UX013** read-only synthetic Feed & Explore test, on 320×640, 390×844, 390×475 and 768×1024:
  - Synthetic post with attached service and product (not a real user).
  - Feed linked-offer panel, service quick-view heading and public provider attribution.
  - Bottom-sheet horizontal/vertical boundaries, >=44px close hitbox, document scroll lock.
  - Keyboard Tab / Shift+Tab trap, Escape close, focus return to original CTA.
  - Actual canonical booking intent href preserving source post; **no booking POST**.
  - Product loading error → Try again → canonical #add-to-cart link.
  - Explore search/tab → published service result → canonical detail href; horizontal overflow.
  - Screenshots + a per-viewport JSON report as CI artifact \`hustle-ux013-journey-evidence\`.
- The QA script runs only on \`http://127.0.0.1\`, intercepts all synthetic GETs, blocks all non-GET methods and all remaining nonlocal requests. It never signs in, takes card details, transacts, invokes real social actions or fabricates an available booking.

**Limitation:** These are UI and link assertions under synthetic data; they are NOT signed-in integration proof, real video tests, a Safari screenshot, Android native IME test, or measured Figma pixel parity. Do not mistake blocked write counters for production security tests.

## Manual signed-in acceptance (release blocking)

Use isolated **staging** with **two invited test accounts** only: a Client and a Hustler, using a staging-only service/post and no personal photos if consent is absent. Capture evidence using filenames \`ux013-<device>-<step>-<pass|fail>.png\`, redact account details, and record actual time/device/browser/API environment. Avoid exposing tokens, phone numbers and IDs in screenshots.

| Step | Acceptance sequence | Pass criteria | Status |
|---|---|---|---|
| 01 Welcome / sign in | Launch fresh install; sign in as Client; kill/reopen | Legitimate account, no fake auth success, no surprise reset | NOT TESTED |
| 02 Feed / video | Load at least two REAL staging posts, one VIDEO and one IMAGE; swipe, pause, mute | Correct media/creator; no blank frames, controls overlap, unintended audio | NOT TESTED |
| 03 Social | Like/unlike, comment, reply, save/unsave, share; use both accounts | UI matches authoritative server after reload; guest social actions require auth | NOT TESTED |
| 04 Explore | Search actual Hustler/skill, switch Top/People/Posts/Services/Products, filter | No stale result races or incorrect type; empty/error/retry truthful | NOT TESTED |
| 05 Profile / offers | Open from Feed and Explore; inspect identity, work and offers | Same real Hustler and listings, verified only with real trust evidence | NOT TESTED |
| 06 Service / consultation | Open attached published service; Message first; return to prepared Booking | Correct context/source; no accidental duplicate message or lost draft | NOT TESTED |
| 07 Appointment / availability | Select real read-only date/time, vary availability, describe task | Real slots + timezone; dates/capacity authoritative; no fake confirmation or payment | NOT TESTED |
| 08 Popup & keyboard | Open comments/save/service/booking sheet; type; press Back once, then twice | Keyboard dismisses first; sheet closes second; no CTA inaccessible or clipped | NOT TESTED |
| 09 Product | Open attached product; verify stock, options/cart controls | Accurate real listing; unavailable products cannot be falsely ordered | NOT TESTED |
| 10 Inbox / response | Client sends staging-only message; Hustler responds, reopen | Correct thread, no cross-account leakage; no false delivered receipts | NOT TESTED |
| 11 Slow/offline/error | Throttle and disconnect staging network; retry and return | Visible recoverable errors, no phantom action success or double submission | NOT TESTED |
| 12 Accessibility | 200% font/text scaling; TalkBack/VoiceOver; landscape & reduced motion | Focus reaches content and dismiss; labels/selection correct; targets >=44–48px | NOT TESTED |

Device requirements: connected Android physical device (compact and large screen), installed iPhone PWA and Safari; 320/360/390/430 CSS widths and one tablet/desktop. Verify safe areas, back navigation, keyboard open/close, long captions, long offer lists and all Figma bottom sheets. Chromium emulation is **not** physical Safari or Android evidence.

### Figma V1 visual acceptance

At 390×844 compare live captures against the 12 frames from \`Knowledge/UX/FIGMA_MOBILE_V1_PARITY.md\`. Check spacing, typography, overlays, background/foreground contrast, floating navigation, CTA visibility and empty/error/loading states. Figma Starter MCP quota previously blocked fresh reference-frame export. Until exact frame screenshots are available and independently compared, mark **pixel parity NOT VERIFIED**, even if layout smoke tests pass.

### Stop/ship criteria

Do not invite external testers if any of the following is true:
- Primary Feed/Explore/Profile/Booking journey cannot be completed in staging or exhibits major layout clipping.
- Guest can mutate likes, bookings, messages or payments, or any unsafe write escapes a guarded test.
- Service availability/booking status is fabricated, or financial actions appear confirmed without real backend authority.
- A sheet traps focus, hides the close control, creates duplicate requests, or cannot be dismissed on a physical device.
- Identity, source post, owner or trust status changes incorrectly between screens.

An engineer/tester must record **device evidence + actual outcomes** in a separate signed-in acceptance report. Completing synthetic CI means \`automated-safe: PASS\` at most; it never sets \`external-testers: APPROVED\` automatically.

## Review artifacts

Latest CI run → Artifacts → \`hustle-ux013-journey-evidence\` (screenshots and \`ux013-journey-results.json\`); existing \`hustle-ux012-figma-visual-review\` for public shells. Artifacts expire after seven days. Store redacted manually verified acceptances under \`Knowledge/UX/\`, never secrets or unconsented media.
