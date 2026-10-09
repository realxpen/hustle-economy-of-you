# Phase 20B — Booking and Order Notifications QA

Status: PR #74 merged, CI green on 2026-10-09. Notification schema already active; no migration required. API and Web production READY at `9bcd33e7cb3e5301820880828b7a35e21bff61f0`. Owner-confirmed production smoke tests on 2026-10-09: Booking request notification and Booking acceptance notification (the applicable free/paid branch), plus seller's new Order alert, correct Order navigation and no buyer self-alert PASSED. Remaining lifecycle and negative-path tests PENDING.
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
- [ ] Cancellation before payment → non-cancelling party notified; paid cancellation remains forbidden by Order domain rule.
- [ ] Retries fail safely / do not duplicate notifications.

## Trust and regressions
- [ ] Unrelated user cannot read Booking or Order detail from inbox URL.
- [ ] Read/unread and MESSAGE grouping remain intact.
- [ ] No external push/email, no economic authority attached to notifications.
- [x] CI Web/Admin/Mobile/API typechecks and Web/Admin/API builds green (PR #74 HEAD `6495605`, workflow run `37937420879` succeeded).
- [x] Owner reports API updated, and Vercel independently confirms API READY on `9bcd33e7cb3e5301820880828b7a35e21bff61f0`; Web also READY at the same SHA. **Runtime acceptance remains pending**.
