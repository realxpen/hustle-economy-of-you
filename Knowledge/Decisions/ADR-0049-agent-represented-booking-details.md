# ADR-0049 — Full Booking Request Detail for Authorized Agents

Status: In implementation; production acceptance pending
Date: 2026-10-09

## Problem
During Phase 20B owner testing, Booking cancellation, decline, Agent-assisted notifications and permission revocation worked. However, an authorized Agent could see summary cards and perform quick Booking actions in the represented Hustler's workspace without having a full Booking detail screen like the Hustler. This makes the Agent workflow incomplete and risks decisions without adequate client-request context.

## Decision
Expose the existing **authorized Agent-specific single-Booking endpoint** through a dedicated Web route:

`/agent-workspace/representations/:principalUserId/bookings/:bookingId`

The Agent's Booking list links to this route with "Review full request →". The new detail view shows:
- Booking status, client identity and corresponding Hustler/principal;
- Service, price/currency and delivery mode;
- Requested and confirmed schedule;
- Client requirements, location, notes, decline/cancellation reasons;
- Payment/funding boundary as **read-only status**;
- Only API-provided `agentAllowedActions`: schedule-aware accept, decline, pre-funding cancel and allowed start;
- Explicit return to represented workspace.

Reuse `getAgentBooking`, `acceptAgentBooking`, `declineAgentBooking`, `cancelAgentBooking`, `startAgentBooking` from existing typed API library. No new public Hustler Booking endpoint or browser-side privilege bypass is introduced. Every read and mutation re-checks active Agent representation, principal ownership, active Hustler capability and `BOOKING_MANAGE` through AgentClientOperationsService. The page reloads and clears prior displayed Booking details when authority fails.

The route must **not** include finance/escrow actions, Booking completion, Reviews, reputation editing, unauthorized client messaging, or Owner-only permissions. Agent Client Messages require separate `CLIENT_MESSAGE_MANAGE`; the Booking detail route does not give those rights.

## Scope and release
- Web-only route and represented workspace navigation; existing API already exposes `GET /agent-client/:principalUserId/bookings/:bookingId` and authorized actions.
- No database migration, API changes or Admin deployment.
- CI and owner manual Web deployment before marking production accepted.
- If owner testing reports that actual read permissions fail, diagnose server authorization rather than lowering the guard.

## Acceptance
- [ ] Authorized Agent opens a represented Booking from the workspace into full detail and sees the same operational request fields as Hustler.
- [ ] Requirements, notes, location, client, schedule and price are displayed accurately and match Hustler view for same Booking.
- [ ] Agent can accept with adjusted confirmed schedule, decline with reason, cancel before funding or start if permitted, with existing action audit.
- [ ] Agent cannot complete work, move money, refund, release escrow, leave a verified Review, or impersonate the Client/Hustler identity.
- [ ] Agent without BOOKING_MANAGE, inactive relationship or wrong principal cannot access this URL or perform mutations; route refresh after scope revocation is denied.
- [ ] The existing notification flow and protected original Hustler Booking route remain unchanged.
- [ ] Web responsive view, CI pass and owner production smoke test.
