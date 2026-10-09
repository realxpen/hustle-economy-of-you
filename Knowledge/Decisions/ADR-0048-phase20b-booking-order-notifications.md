# ADR-0048 — Phase 20B Booking and Order Lifecycle Notifications

Status: PR #74 merged (`9b2370282af01fd9a69d7d33ef9616aaf0af664b`), CI green 2026-10-09; manual API deployment and owner runtime acceptance pending
Date: 2026-10-09

## Context

Phase 20A gives Hustle a secure, persistent notification inbox and grouped direct-message alerts. Booking requests and commerce transactions already have authoritative state machines, including payment-confirmed statuses and Agent-delegated Booking operations. These meaningful updates should appear in the same activity inbox without inventing payment authority.

## Decision

The NestJS NotificationsService receives API-owned event inputs, always built server-side from authenticated Booking and Order records. Clients cannot create or choose notification recipients, statuses or links.

The existing Notification table and NotificationKind.BOOKING/ORDER enum values support this slice. No new schema migration.

Every new notification uses a deterministic per-transaction status key, such as `booking:<booking-id>:REQUESTED` or `order:<order-id>:SHIPPED`, enforced unique per recipient in the database. Existing Message notification grouping remains MESSAGE-only. Booking and Order cards are independent per event.

Booking:
- REQUESTED → Hustler;
- ACCEPTED or PAYMENT_PENDING, DECLINED, IN_PROGRESS, COMPLETED → Client;
- FUNDED, only after authoritative payment integration → Hustler;
- CANCELLED → non-cancelling Booking party;
- denied/failed transitions and unexpected states → no notification.

Order:
- PENDING after actual checkout → Seller;
- PAID after authoritative payment confirmation → Seller;
- PROCESSING, SHIPPED, DELIVERED → Buyer;
- COMPLETED after Buyer confirmation → Seller;
- CANCELLED → non-cancelling order party.

Each alert links into its authorized `/bookings/:id` or `/orders/:id` detail page. Viewing the alert does not confer access to that Booking or Order, and the original route still checks participant access.

## Consistency

Where the Booking or Order mutation already executes in a Prisma transaction, creating a notification is included in **that same transaction** with `createMany({ skipDuplicates: true })`. Booking create and Booking transition methods now use transactions so recipient notification creation shares the state-change atomicity. Order checkout/payment and fulfillment already use transactions; notifications join them.

Agent-delegated Booking operations reuse the transaction owned by AgentClientOperationsService. The notification recipient remains the relevant Client; the Agent is recorded as the actor in existing delegation/audit data. Notification creation never grants the Agent more authority.

Existing SystemEvent and financial settlement logic remain unchanged; notification text is derived only from known authoritative status, not a payment intent or unverified client claim. No new payment, escrow, payout, review, role-switch, public broadcast, SMS or push authority.

## Product limits

- Not an email/push system; in-app notifications only.
- No automatic enrichment using private customer addresses, document details or message previews.
- Later phases add application, Review, Live and social events plus notification preference controls.
- Existing per-status deduplication assumes monotonic canonical state transitions; any future reversible transition must adopt event-instance keys before enabling repeated occurrence notifications.
- Post-payment retry/idempotency is governed by existing payment modules; no notification generation from standalone UI/payment-pending intent.

## Acceptance

- [ ] Client places Booking → Hustler gets one REQUESTED notification; Client not notified for own request.
- [ ] Hustler accepts paid/unpaid Booking → Client gets appropriate accepted/payment-pending notification.
- [ ] Decline/cancel → affected counterparty gets accurate update; no alert after invalid transition.
- [ ] Agent acts with BOOKING_MANAGE → Client notified; principal/Agent audit provenance preserved, and unauthorized Agent gets no alert.
- [ ] Only authoritative FUNDED Booking and PAID Order changes produce payment-related alerts; no money moves from notification creation.
- [ ] Checkout → Seller receives one new Order notification, Buyer no self-alert.
- [ ] PROCESSING, SHIPPED, DELIVERED → Buyer receives status updates; COMPLETED → Seller notified.
- [ ] Cancellation notifies other party; restrictions on paid Order cancellation remain enforced.
- [ ] Duplicate retries do not create duplicate status notifications and protected participant routes remain protected.
- [ ] User-scoped unread/read, stable pagination and Message notification grouping remain unchanged.
- [ ] All CI typechecks/builds green, manual owner-controlled API release and frontend runtime acceptance.

## Release

No database migration for Phase 20B. PR must pass CI and be reviewed/merged before the owner manually deploys **API only**. No Web/Admin redeploy required because the existing Activity inbox already renders BOOKING/ORDER kinds generically. Do not deploy for the owner.
