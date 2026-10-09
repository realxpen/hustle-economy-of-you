# Phase 20B — Booking and Order Notifications QA

Status: PR #74 merged, CI green on 2026-10-09. Notification schema already active; no migration required. API and Web production deployments verified READY at `9bcd33e7cb3e5301820880828b7a35e21bff61f0` on 2026-10-09. Owner runtime acceptance tests listed below remain PENDING.
Scope: API-owned, in-app Booking/Order lifecycle notices.

## Booking (disposable accounts, no live money)
- [ ] New Booking request → exactly one Hustler card links to the right Booking; not the Client.
- [ ] Booking accepted (free) → Client notified.
- [ ] Booking accepted (paid) → Client informed payment is pending, not falsely marked paid.
- [ ] Decline/cancel → correct counterparty notified; invalid status transitions create no alerts.
- [ ] Agent with permitted BOOKING_MANAGE acts on principal's Booking → Client notified and Agent audit actor remains unchanged.
- [ ] Agent without permission is denied; no alert created.
- [ ] After authoritative sandbox funding only: FUNDED → Hustler notified; no live escrow/refund/payout side effects.
- [ ] Start and completion → Client notified at correct statuses.

## Order (disposable sandbox orders)
- [ ] Checkout → Seller gets new Order card; Buyer is not spammed about own checkout.
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
