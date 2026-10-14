# Hustle — Customer Journey Validation / Milestone 2

Date: 2026-10-14
Status: **Implementation in one consolidated PR; GitHub CI and signed-in acceptance must be verified before milestone completion.**

## Verified prior baseline

MVP Service journey PR #115 merged into main as `bd716d7820f36306aaed55a25a2c86e64c6843e7` after all three final-head CI workflows passed on `727831e59b0f68431aca068804dd9defdbc73b8e`. Its actual Nest/Prisma/Postgres integration covered published proof, discovery, canonical Service, consultation, Booking, test-only signed funding, work completion and simulated escrow release. It did not establish deployed or signed-in browser/device acceptance.

## Milestone 2, first consolidated QA slice

1. **Booking work-start alignment:** The Hustler's Web Start work action follows the server gate: free accepted bookings may start, paid bookings require `FUNDED` plus the `paymentBoundary.funded` flag. The backend remains the authority.
2. **Money-state copy:** Booking and transaction surfaces distinguish a server-recorded simulated funding/release from real provider settlement. `HUSTLE_SANDBOX` cannot be described as real collected funds.
3. **Interactive Chromium regression:** On the *local* Next.js build, a synthetic published public Service can be viewed and navigated to the actual Booking form. Required description and invalid end-before-start checks operate before any Booking write. A temporary Service 404 can be retried.
4. **Always-on CI:** Static financial gating checks and interactive local Chromium regression run in Foundation CI. The prior isolated database/financial tests remain intact.

## Important test boundaries

The browser test intercepts only the public Service GET, uses fake data, and intentionally never signs in. It makes **zero payments, uploads, genuine bookings, production calls, or BMONI requests**. Do not cite it as proof of authenticated checkout.

## Completion gates still outstanding

- [ ] Final PR head has green Foundation, Isolated Payment Sandbox and MONIFlow sandbox handshake CI.
- [ ] On an approved nonproduction environment, Client registers/signs in, completes onboarding and discovers a real published Hustler.
- [ ] Hustler capability is requested/approved according to existing permissions and can publish a Service and proof Post.
- [ ] Client opens a Service-context conversation and creates a real test Booking; only its Hustler can accept/complete.
- [ ] Signed-in Web (desktop + mobile viewport), iOS Safari and Android browser/app acceptance are performed with approved test accounts.
- [ ] Test-only payment state is explicitly marked simulated. Real collection, real escrow, refunds, payouts and provider activation remain blocked on separate PSP/legal authorization.

## AED execution boundary

Experience Architecture → Build → System Activation → Shadow only when real participant/environment evidence exists. No fabricated onboarding success, payment proof, review or real transaction. Keep this as **one milestone PR**, not a micro-PR chain.
