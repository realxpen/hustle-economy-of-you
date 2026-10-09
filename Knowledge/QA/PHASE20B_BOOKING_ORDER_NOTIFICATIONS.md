# Phase 20B — Booking and Order Notifications QA

Status: PR #74 merged, CI green on 2026-10-09. Notification schema already active; no migration required. API and Web production READY on Phase20B-inclusive deployments. Owner-confirmed production tests: Booking creation/acceptance, cancellation/decline, Agent-delegated notifications and scope denial, Order checkout, **unpaid Order cancellation, rejected repeat cancellation, unauthorized Order URL access, and Message grouping/Order read state** all PASSED. Financially sensitive sandbox-paid transitions and remaining Order fulfillment scenarios are PENDING.
Scope: API-owned, in-app Booking/Order lifecycle notices.

## Booking (disposable accounts, no live money)
- [x] New Booking request → exactly one Hustler card links to the right Booking; not the Client. Owner-confirmed 2026-10-09.
- [ ] Booking accepted (free) → Client notified.
- [ ] Booking accepted (paid) → Client informed payment is pending, not falsely marked paid.
- [x] Decline/cancel → correct counterparty notified; invalid status transitions create no alerts. Owner reported success 2026-10-09 (test using disposable unpaid Bookings).
- [x] Agent with permitted BOOKING_MANAGE acts on principal's Booking → Client notified and Agent audit actor remains unchanged. Owner reported action/notification working 2026-10-09; however full Agent request detail was missing in Web UI and is tracked in ADR-0049.
- [x] Agent without permission is denied; no alert created. Owner reported pass 2026-10-09.
- [ ] After authoritative sandbox funding only: FUNDED → Hustler notified; no live escrow/refund/payout side effects.
- [ ] Start and completion → Client notified at correct statuses.

**Booking acceptance smoke test:** Owner confirmed the acceptance notification reached Client A with correct status copy for the tested price path. The owner did not identify whether the disposable Booking was free or paid, so separate free-Booking and payment-pending checkboxes below remain open for targeted acceptance.

**Known UX gap found in this acceptance session:** Agent could perform granted Booking actions but lacked the full Booking request detail view the Hustler sees. Separate **Web-only correction** and permission regression checks: `Knowledge/QA/AGENT_BOOKING_DETAIL_RUNTIME_ACCEPTANCE.md` (ADR-0049). This must pass before declaring complete Agent operational parity.

## Order (disposable sandbox orders)
- [x] Checkout → Seller gets new Order card, opens correct Order; Buyer is not spammed about own checkout. Owner-confirmed 2026-10-09.
- [ ] Authoritative sandbox payment confirmation → Seller receives PAID notice, never before.
- [ ] Fulfillment status PROCESSING/SHIPPED/DELIVERED → Buyer gets correct notice.
- [ ] Buyer COMPLETED → Seller notified.
- [x] Cancellation before payment → non-cancelling party notified. Owner-confirmed using an unpaid Order on 2026-10-09.
- [ ] Paid Order cancellation remains forbidden by canonical Order rules (requires isolated sandbox-funded test; NOT independently confirmed).
- [x] Repeating cancellation of the same already-cancelled Order is rejected and creates no duplicate cancellation notification. Owner-confirmed 2026-10-09.
- [ ] Other Order transition retries and duplicate authoritative payment confirmations are idempotent in an isolated sandbox.

## Trust and regressions
- [x] Unrelated User C cannot read the Order detail via inbox URL. Owner-confirmed 2026-10-09.
- [ ] Unrelated user cannot read a Booking detail via an inbox URL (not tested in this four-step group).
- [x] Order notification mark-read and existing MESSAGE conversation grouping remain intact. Owner-confirmed 2026-10-09.
- [ ] No external push/email, no economic authority attached to notifications.
- [x] CI Web/Admin/Mobile/API typechecks and Web/Admin/API builds green (PR #74 HEAD `6495605`, workflow run `37937420879` succeeded).
- [x] Owner reports API updated, and Vercel independently confirms API READY on `9bcd33e7cb3e5301820880828b7a35e21bff61f0`; Web also READY at the same SHA. **Runtime acceptance remains pending**.
