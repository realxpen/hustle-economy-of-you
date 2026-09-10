# ADR-0010 — Booking lifecycle and payment boundary

Status: Accepted
Date: 2026-09-10

## Context

Hustle now supports discovery, Search, Services, direct Messaging, and private message attachments. The next capability is turning a Service into a structured transaction request.

The approved MVP source requires a Booking flow:

`Service → Book → Choose date/time → Requirements → Request → Hustler accepts → Payment → Work begins → Completion`

It also defines explicit states:

`REQUESTED, ACCEPTED, DECLINED, PAYMENT_PENDING, FUNDED, IN_PROGRESS, COMPLETED, CANCELLED, DISPUTED, REFUNDED, CLOSED`.

AED simulation identifies ambiguous transaction state and partial financial failure as major trust risks. At the same time, the approved phase plan assigns real payment, escrow, ledger, refund, payout, reconciliation and webhooks to Phase 13.

We need a Booking model now without pretending that Phase 11 already owns money movement.

## Decision

### 1. Booking is a first-class canonical transaction entity

A Booking is not a Message, notification, or Service flag.

It references:
- Client User
- Hustler User
- Service
- optional direct Conversation

It stores its own lifecycle and transaction-critical agreed terms.

### 2. Booking uses one unified User identity

No buyer account, seller account, Client-mode inbox, Hustler-mode dashboard identity, or role switcher is introduced.

Authorization is relationship/capability based:
- booking client actions derive from `clientUserId`
- provider actions derive from `hustlerUserId` plus ACTIVE HUSTLER capability

### 3. Lifecycle state is explicit and server-authoritative

The Booking status enum uses the source-defined states:

- REQUESTED
- ACCEPTED
- DECLINED
- PAYMENT_PENDING
- FUNDED
- IN_PROGRESS
- COMPLETED
- CANCELLED
- DISPUTED
- REFUNDED
- CLOSED

Clients cannot submit arbitrary target statuses. Application services enforce allowed transitions.

### 4. Phase 11 stops at the payment boundary for paid Services

Phase 11 may create `PAYMENT_PENDING` when a paid booking is accepted.

It must not mark a paid Booking `FUNDED` based on a client request, frontend action, fake payment toggle, or unverified external callback.

The transition into `FUNDED` is reserved for the authoritative Phase 13 payment/escrow integration.

This means the source-defined full paid-service journey remains the integrated Phase 11+13 gate rather than being falsely simulated in Phase 11.

### 5. Booking stores a narrow historical terms snapshot

The Service remains canonical for marketplace discovery, but a Booking must preserve the terms that were agreed/requested so later Service edits do not silently rewrite transaction history.

The snapshot is limited to transaction-critical fields such as:
- price minor units
- currency
- pricing type
- service title/reference label
- requested/confirmed schedule

This is intentional historical integrity, not a duplicate Service entity.

### 6. Existing Messaging is reused

A Booking may link to the existing direct Conversation for the same two Users.

Booking state remains authoritative in Booking. Message text/context cannot mutate Booking lifecycle.

Once the Booking domain exists, Messaging may support `BOOKING` as an additional canonical context type.

### 7. Scheduling starts simple and deterministic

MVP scheduling uses concrete requested/confirmed timestamps and server-side conflict checks against active Bookings for the Hustler.

We defer:
- external calendar integrations
- recurring availability engines
- timezone recommendation AI
- optimization/smart scheduling

until actual usage shows they are needed.

### 8. Booking transitions are observable

SystemEvent records lifecycle events using IDs and non-sensitive metadata. Requirements/job brief text must not be copied into analytics payloads.

## Consequences

### Positive
- Transaction state stays understandable.
- Phase 13 can integrate payments without redesigning Booking ownership.
- No fake payment success enters the product.
- Booking history remains stable when Service listings change.
- Existing Messaging is reused rather than fragmented.
- Authorization remains compatible with Hustle's additive capability model.

### Tradeoffs
- Phase 11 alone cannot honestly complete a paid Service through FUNDED without Phase 13.
- Some source-defined end-to-end completion validation is therefore deferred to the integrated Booking + Payments gate.
- A narrow snapshot introduces controlled duplication, but it is required for transaction audit/history integrity.

## Rejected alternatives

### Store Booking state in Messages
Rejected because chat is communication, not an authoritative transaction state machine.

### Mutate the Service to represent active booking state
Rejected because one Service can have many Bookings and listing state is not transaction state.

### Let the frontend set arbitrary Booking statuses
Rejected because lifecycle authorization must be server-side.

### Fake FUNDED in Phase 11
Rejected because it would create false financial state and violate the Payments + Escrow phase boundary.

### Create separate Client and Hustler booking accounts
Rejected because Hustle uses one unified User identity with additive capabilities and no role switching.
