# ADR-0065 — Evidence-based frontend stabilization and release gate

Date: 2026-10-11
Status: Stabilization PR implementation; CI and real-device acceptance pending
Scope: Next.js Web, scripts and CI workflows, no backend contract, identity, funds or Agent delegation changes.

## Problem
Hustle's integrated Web UX Builds #96, #97 and #98 are merged on main but production is still deployed from an earlier SHA. The source contracts and builds passing do NOT establish working mobile browser/authorized runtime flows. Existing read-only viewport audit could count a 404/500 page or authentication redirect as a visually passing page, and it had no durable artifact for a release decision.

Source review also found a cross-route private data hazard in Story interactions: a late reaction/reply request issued for Story A could update Story B's viewer counts and even private replies after a fast route change. A simple clearing of state at route change is not enough to block *late asynchronous mutations*.

## Decision
- Maintain one-account roles and canonical API as the owner of publishing, trust, booking, money and Agent authorization.
- Gate merge on Foundation CI (static UX contracts, TypeScript, Prisma generate, Web/Admin/API production builds) and **isolated local Chromium** actual-document smoke after the Web build. Test 320, 390 (normal and short), 768 and 1440 CSS pixel widths with both light/dark themes. Local smoke is read-only, targets exclusively 127.0.0.1 and does not sign in, create content, book, publish or pay.
- Owner-triggered deployed-site multi-viewport browser audit must report pass/fail/incomplete honestly. Failed HTTP documents fail; protected routes redirected to auth are unverified and make the audit INCOMPLETE, not PASS. Preserve machine-readable evidence via GitHub Actions artifact.
- Story reaction/reply completions only modify currently viewed Story ID; clear old private draft text, replies and busy state when navigating.
- A launch release requires matching deployed Web/API SHA and a human-executed, authenticated test pass on physical iOS Safari/Android Chrome/desktop, plus explicit isolated finance and Agent permission/revocation sign-off. See acceptance matrix.

## Out of scope / nonclaims
Chromium emulation is NOT physical iPhone Safari or native Expo. A locally built shell does not prove signed-in data, real Story uploads, LiveKit broadcast, payment provider state, or real private permissions. Automated tests never create transactions; owner controls Vercel production deployment. Dependency audit warnings and privacy retention/deletion policy require independent review before general launch.
