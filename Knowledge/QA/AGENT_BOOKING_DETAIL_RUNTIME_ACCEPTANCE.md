# Agent Booking Detail — Owner Runtime Acceptance

**State:** implementation in progress; no production deployment yet.
**Source:** owner Phase 20B feedback on 2026-10-09. Four preceding notification/cancellation tests reportedly worked, but the Agent lacked a Hustler-equivalent detail screen for represented Booking requests.

## Detailed request experience
- [ ] With a disposable approved Agent who has `BOOKING_MANAGE`, open represented Hustler → Client Bookings → **Review full request**.
- [ ] Confirm matching details against Hustler's Booking view: client, service, price, status, requested/confirmed dates, requirements, location, notes and any decline/cancellation reasons.
- [ ] As Agent, adjust confirmed time on an eligible Booking request and accept. Confirm updated schedule and visible Agent audit attribution.
- [ ] Verify decline, pre-funded cancel, and permissible start actions on **separate** safe test Bookings.
- [ ] Confirm read-only payment/funding boundary; no financial actions, complete, reputation or ungranted message authority.

## Access and regression
- [ ] Agent without `BOOKING_MANAGE` cannot access a deep-linked Booking detail.
- [ ] Agent cannot open Booking for a different principal or non-represented Client.
- [ ] Revoke `BOOKING_MANAGE` after initial successful view; refresh or reopen URL fails, no sensitive Booking details shown; action fails too.
- [ ] Existing Hustler Booking view, Client view, notifications and Agent action audit still operate.
- [ ] Web mobile and desktop layout are readable.

## Build/release
- [ ] PR CI green; merged.
- [ ] Owner manually deploys **Web only**. No API, database migration, or Admin redeploy.
- [ ] Owner confirms production behavior and deployment SHA.
