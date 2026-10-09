# Agent Booking Detail — Owner Runtime Acceptance

**State:** PR #75 merged (merge commit `7060d0a2dab10fbe1b67ec591664ea11fa459fb6`) with GitHub CI successful. Owner reported Web updated on 2026-10-09; Vercel independently verified Web production READY at that exact SHA. **Functional runtime acceptance checks below still pending.**
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
- [x] PR #75 CI green (run `37941935853`); merged as `7060d0a2dab10fbe1b67ec591664ea11fa459fb6`.
- [x] Owner reported Web updated; independently verified Vercel Web production READY at `7060d0a` on 2026-10-09. No API/database/Admin redeployment required.
- [ ] Owner confirms production behavior and deployment SHA.
