# Phase 20B — Booking and Order Notifications QA

Status: implementation in progress; CI and production runtime acceptance pending.
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
- [ ] CI Web/Admin/Mobile/API typechecks and Web/Admin/API builds green.
- [ ] Owner deploys API manually after merge and confirms runtime acceptance with exact SHA.
