# Hustle — MVP End-to-End Service Opportunity Journey

Date: 2026-10-14
Status: **ONE CONSOLIDATED MVP INTEGRATION AND STABILIZATION PR; owner review pending.**
Product rules: Hustle, single account with progressive Hustler capability, content as proof, Nigeria-first, no claim of real payment without verified external provider status.

## Goal

Prove one existing canonical product journey as a **connected system** rather than building already-implemented screens again:

`Published proof → Discover/Marketplace → attached Service → consultation → Booking request → Hustler acceptance → PAYMENT_PENDING → locally signed sandbox payment → FUNDED/held escrow → Hustler starts/completes → Client releases sandbox escrow → ledger/reputation-ready completion.`

Existing modules already expose most of these individual experiences. The missing assurance was their joined behavior against a disposable real database and transparent sandbox UX.

## Integrated acceptance implemented

In the existing localhost-only `scripts/payment-sandbox/run.mjs`, extend the **actual Nest+Prisma+Postgres** test, preserving all previous Order, webhook, notifications, trust, analytics and MONIFlow RECEIVED-only checks:

1. Create two disposable single-account Users (a Client, an ACTIVE Hustler), published Professional Profile, paid published Service, and published Post with real Service attachment.
2. Retrieve the real For You Feed and the real Marketplace result; verify both expose the same canonical paid Service ID. No fabricated content, fake attachments or unverified seller badge.
3. Open a direct conversation and send a server-validated Service-context consultation message. A nonparticipant cannot send.
4. Client requests a future Service Booking with this conversation; assert immutable 45,000 NGN-minor-unit transaction terms and REQUESTED. Other users cannot read it or accept as the Hustler.
5. Hustler accepts; state advances to PAYMENT_PENDING. Starting work is rejected without funding. Client initializes HUSTLE_SANDBOX payment; no funded escrow or withdrawable Hustler balance is created.
6. Unsigned sandbox webhook is rejected and Booking remains PAYMENT_PENDING. Locally HMAC-signed **fixture** payment confirmation advances only this Booking to FUNDED/HELD. Redelivery must not duplicate the PAYMENT_CONFIRMED posting. Never treat MONIFlow RECEIVED as provider settlement.
7. Client cannot release before completion. Hustler starts/completes after funding; Hustler cannot release Client escrow.
8. Client releases once; duplicate release is detected; ledger has one ESCROW_RELEASED transaction and Hustler available balance increases by exactly agreed price. Funds in the *test ledger* only; no external money moves.

## Web journey stabilization

- Transaction finance components on both Booking and Order pages are keyed to `BOOKING:<id>`/`ORDER:<id>`, ensuring client-side money status isn't recycled when viewing a different transaction.
- Any `HUSTLE_SANDBOX` attempt is labeled **Sandbox simulation — no real payment or provider settlement**, including when the local ledger reports a fixture-funded state.
- The Sandbox payment-init notice explicitly says that no real money moved and provider status still requires a signed test event.
- `scripts/experience/check-complete-service-journey.cjs` protects the existing Discover → offer Quick View → Service → consultation/Booking → signed payment-status route, plus the new subject identity and simulated-provider labels, in the normal Foundation CI.
- No new account/role model, booking identity, custom financial authority, provider API, schema, deployment or real-payments service was added.

## Automated CI gates

- [ ] Foundation CI green at exact PR head: Web/Admin/Mobile/API typecheck, Prisma generate, builds, existing navigation/source contracts, new complete Service journey contract and local Chromium smoke.
- [ ] Isolated Payment Sandbox green at exact PR head: **disposable localhost PostgreSQL 16** with existing RLS-compat role setup, actual Nest API build and end-to-end Order + the new Service/booking/escrow flow.
- [ ] No external BMONI calls, production credential, real KYC data, merchant collection, real payout, refund or third-party custody.
- [ ] HMAC, duplicate delivery, unauthenticated/cross-user authorization and escrow release invariants respected.

## Unverified runtime layers (DO NOT claim success)

- Physical iOS Safari/Android and real sign-in/auth browser E2E remain owner-operated acceptance. Static navigation contracts and server-only isolated Postgres tests do **not** prove real user-facing frontend interaction end-to-end or deployed data quality.
- The Web deployed SHA may differ from latest main and must be compared by owner before manual release.
- Signed in Web/Native service journey testing requires disposable customer and ACTIVE Hustler accounts whose permissions are owned by the user.
- App-side payment success cannot be simulated via a browser. Any real-money gate requires a separately approved PSP/BMONI contract and compliant custody arrangement.
- Production deployment is manual and owner-authorized, never triggered by this milestone.

## External dependencies and next decision

MONIFlow B2 identity readiness is separate and does not grant provider authority. BMONI `409` existing-user recovery, Nigerian merchant acquiring, booking-level verified payments, lawful escrow/refund and third-party payout are still **NO-GO** pending BMONI or an alternative authorized PSP.

After exact-head CI green, owner reviews **one substantial PR** and decides whether to perform signed-in deployed/browser acceptance next. Do not open a micro-PR per fix, and do not claim MVP launched until physical device/authenticated Tier C–E checks pass.
