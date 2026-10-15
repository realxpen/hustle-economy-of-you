# Hustle — Booking Draft Conversion (Consolidated Customer Journey)

Date: 2026-10-15
Status: **Implemented on one consolidated milestone branch; final-head CI and owner review required.**

## Merged baseline

Hustle PR #118 was merged on 2026-10-15 at `4ae53bba94c239c2b53c73bb5862b6e0b478e809`, adding opt-in, read-only real-session acceptance instrumentation for an approved staging environment. Actual signed-in staging checks have **not** been run.

## User problem

A Client sees content that demonstrates a Hustler's capability, opens a published Service, writes requirements and selects a schedule, and then is prompted to authenticate. The earlier auth-return patch preserved the route but **not the filled form**. The Client would have to type everything again, risking abandonment before an actual Booking is sent.

## Functional change

- Keep a small, Service-scoped draft in the current tab's `sessionStorage`, updated on field edits. Fields: requested start and end, requirements, optional location and notes. Never include account credentials, payment details, user IDs, wallet balances, or financial authority.
- Restore only for the exact same published Service, only if the draft is intact and saved in the last **two hours**.
- Show a clear local-draft status and **Clear draft** action; clearing resets the visible form and deletes the stored value.
- Before checking authenticated availability or opening the consultation/Booking POST path, check the actual Supabase browser session. If signed out, send the Client through the existing safe `/auth?next=...` handoff without losing the prepared form.
- Clear the draft only after a **successful Booking API response**, then navigate to the canonical booking detail. A failed availability check, network error or refused payment never fabricates booking success.
- Save/restore is best-effort: private browsing or disabled storage does not prevent the app from operating, and no draft is copied to the backend.

## Automated evidence

1. Foundation CI invokes the real TypeScript helper (via transpilation) and covers valid drafts, expiry, corrupted values, wrong Service IDs, oversize values, storage failures and explicit clearing.
2. Chromium local Web now opens a synthetic published service, enters booking details, verifies invalid schedule rejection with **zero Booking writes**, reloads the page, verifies draft restoration, clears the draft and verifies zero Booking writes.
3. The existing isolated payment and MONIFlow sandbox workflows continue to protect financial boundaries. The browser fixture is still not a real authenticated staging session.

## Outstanding acceptance before Lagos pilot

- [ ] Final-head Foundation CI, payment sandbox, MONIFlow handshake pass.
- [ ] Owner reviews one milestone PR.
- [ ] Approved staging Client arrives via published Hustler content, writes a Booking draft, signs in or signs up, sees intact requirements and schedule, and voluntarily submits a nonpayment test Booking.
- [ ] Separate approved Hustler accepts the Client's Booking; the Client confirms it appears in their Booking Manager.
- [ ] Confirm same-tab storage behavior, 2-hour expiry, and clear-draft behavior on real Android/iOS and browser back-navigation.
- [ ] Real payment, legal escrow custody, payouts, refunds, BMONI merchant rights and production launch remain separately blocked pending provider and regulatory evidence.

**AED:** This is a customer-conversion Build milestone, not a new payments/identity milestone. Reassess with real Client/Hustler observation; do not equate local synthetic GET testing to actual account acceptance.
