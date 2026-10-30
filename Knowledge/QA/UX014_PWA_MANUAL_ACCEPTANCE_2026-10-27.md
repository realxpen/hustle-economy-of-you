# UX014 — PWA manual acceptance report

**Date (Nigeria):** 2026-10-27
**Surface:** Regular isolated **iPhone PWA staging** at https://hustle-ios-pwa-staging.realxpens.workers.dev/
**Status:** Core-journey self-report received; hardened tester-release acceptance **OPEN**.

## Exact-head deployment evidence — independently verified

- GitHub Actions **Hustle Cloudflare Regular Staging AWS Cutover (manual only)** [run 40519455198](https://github.com/realxpen/hustle-economy-of-you/actions/runs/40519455198), triggered at 2026-10-27 14:15:53 UTC, succeeded.
- Deployed GitHub SHA: `c85b7e556c6487965aab1c731aaa2604806c830d`, the PR #248 merge commit. Therefore the Cloudflare Worker deploy **contains** the latest UX011/UX012/UX013 visual work at that commit.
- That run's GitHub jobs show **PASS** for exact staging intent, isolated Lambda health, blocked real-payment initialization, staging cutover contracts, build, deploy, and anonymous staging smoke. API smoke checks only the anonymous auth page, isolated API health and unauthenticated notification denial.
- GitHub [main Foundation CI run 40510232563](https://github.com/realxpen/hustle-economy-of-you/actions/runs/40510232563) passed for the merged SHA.
- This does **not** prove session identity, signed-in app behavior, UI pixel parity, or device accessibility.

## Six positive user-reported checks (not instrumented)

In this conversation the founder submitted all six checklist entries as **Passed**. These are **manual self-reports**, NOT independently reproduced, screenshot-evidenced, or fully granular sign-offs:

| ID | Reported result | Evidence class | Source |
|---|---|---|---|
| PWA-01 | Sign in and verify Home Feed — PASS | Founder self-report | UX014 six-item checklist |
| PWA-02 | Open posts, videos and attached offers — PASS | Founder self-report | UX014 six-item checklist |
| PWA-03 | Search Explore and open Hustler profiles — PASS | Founder self-report | UX014 six-item checklist |
| PWA-04 | Test comments, saves and popup dismissal — PASS | Founder self-report | UX014 six-item checklist |
| PWA-05 | Test service consultation and booking — PASS | Founder self-report | UX014 six-item checklist |
| PWA-06 | Check Inbox, notifications and account — PASS | Founder self-report | UX014 six-item checklist |

No failing journey or defect was reported in this message. Do not infer that videos played on both Safari and standalone PWA, or that an actual booking, payment, review or message was persisted, from the six summary checkmarks. No evidence screenshots were supplied with these checkmarks. Device/browser build details and timing of each action were not logged.

## UX014-B — next **hands-on** iPhone PWA verification

Use **only invited staging test accounts**; do not use real money, personal credentials, outside recipients, or a production listing. Prefer a separate disposable Client and Hustler.

| ID | How to test | Expected observable result | Status |
|---|---|---|---|
| PWA-B01 Session restore | Sign in, close/force-quit installed Hustle, reopen from Home Screen; then open Safari separately | Genuine session restores appropriately within each origin/app context; no false signed-in UI or infinite redirect | NOT TESTED |
| PWA-B02 Logout protection | Sign out, use browser Back, then directly visit /messages, /account, a booking form and notifications | Protected information remains inaccessible without a valid session; no stale personal data on Back | NOT TESTED |
| PWA-B03 Offline/recovery | While on Feed, enable Airplane Mode, try loading a fresh post/search, then restore network and retry | Truthful offline message; no fabricated success; recovering does not duplicate requests/posts | NOT TESTED |
| PWA-B04 Keyboard & sheet | Open comments, start typing; dismiss keyboard, close sheet, reopen; repeat with long caption or booking form | Close remains visible; first dismissal handles keyboard; input not hidden behind floating dock | NOT TESTED |
| PWA-B05 Two-account isolation | Test Client and Hustler in **separate invited sessions**; create staging-only message/booking, then switch identities | Correct author/recipient; no other account's messages, bookings, wallet, Activity visible | NOT TESTED |
| PWA-B06 Accessibility/visual | Safari and installed PWA, normal and 200% text; VoiceOver; portrait/landscape; compare with Figma Mobile V1 | No clipping, legible controls, correct VoiceOver labels/focus, no dock/CTA collision; Figma parity evaluated | NOT TESTED |

**Evidence capture:** `ux014-pwa-b0X-<pass|fail>.png` + device/iOS/browser or installed-PWA status, actual time, and observed behavior. Redact personally identifying account information, session tokens, messages and payment data before sharing. Upload only safe examples.

## Release decision

**Core PWA journey smoke:** 6/6 **reported PASS**.
**Staging exact-head deployment:** VERIFIED GitHub Actions PASS.
**UX014 negative-path, two-user and real accessibility acceptance:** **NOT TESTED**.
**12 Figma frame visual parity:** **NOT VERIFIED**.
**Native Android and physical iOS Safari full matrix:** **NOT TESTED**.
**External tester invitation:** **BLOCKED pending security/persistence/error, two-account, device and visual sign-off.**

This report does not change production runtime, backend policies, payment/escrow configuration, or previously documented release gates.
