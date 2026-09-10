# Booking System

Status: CANONICAL — Phase 11 ACTIVE
Updated: 2026-09-10

## Purpose

Booking is the operational bridge between discovery and service delivery.

Canonical flow:

`Discovery → Service → Booking request → Schedule/requirements → Hustler decision → Payment boundary → Work → Completion`

The Phase 11 source flow is:

`Service → Book → Choose date/time → Provide requirements → Submit request → Hustler accepts → Payment → Work begins → Completion`

Booking must make the current transaction state explicit. A user should never need to guess whether a request is waiting for the Hustler, waiting for payment, active, complete, cancelled, disputed, refunded, or closed.

## Identity and ownership

Booking uses the same unified Hustle User identity.

A booking links:
- one Client User
- one Hustler User
- one canonical Service
- optionally one existing direct Conversation

Do not create separate buyer/seller identities or role-switching booking modes.

Canonical relationship:

`Service → Booking`

`Booking → client User`

`Booking → hustler User`

`Booking → optional Conversation`

The Service remains the canonical offer. Booking may preserve the agreed transaction terms needed for historical/audit integrity, but it must not duplicate the entire mutable Service record.

## Booking lifecycle

Canonical statuses:

- `REQUESTED`
- `ACCEPTED`
- `DECLINED`
- `PAYMENT_PENDING`
- `FUNDED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `DISPUTED`
- `REFUNDED`
- `CLOSED`

These states are explicit because ambiguous transaction state is a known ecosystem risk.

### Normal paid-service path

`REQUESTED`
→ Hustler accepts
→ `ACCEPTED`
→ payment required
→ `PAYMENT_PENDING`
→ payment/escrow confirms funds
→ `FUNDED`
→ work starts
→ `IN_PROGRESS`
→ work completed
→ `COMPLETED`
→ later review/reputation flow
→ `CLOSED`

### Decline path

`REQUESTED → DECLINED`

### Cancellation path

Cancellation is allowed only through explicit lifecycle rules. The system must record who cancelled, when, and why where applicable.

### Dispute/refund path

`DISPUTED` and `REFUNDED` exist in the Booking lifecycle, but authoritative financial dispute/refund execution belongs to Phase 13 Payments + Escrow and later Trust/Operations capabilities.

## Phase 11 payment boundary

Phase 11 owns Booking state and scheduling. Phase 13 owns real payment, escrow, ledger, refund, reconciliation, payout, and financial webhooks.

Therefore Phase 11 must NOT:
- fake a successful payment
- mark a paid booking FUNDED without an authoritative payment/escrow event
- create a wallet balance
- simulate money movement as if it were real

Phase 11 should expose a clean application-service boundary so Phase 13 can later advance an eligible Booking from `PAYMENT_PENDING` to `FUNDED` idempotently.

For paid Services, the Phase 11 implementation/runtime gate ends at the explicit payment boundary unless Phase 13 is already available. Full source flow through funded completion becomes an integrated gate once Phase 13 is connected.

## Booking creation

A synchronized Client can create a booking from a currently public eligible Service.

Required MVP inputs:
- Service ID
- requested date/time
- requirements / job brief

Optional inputs where useful:
- location/details for physical work
- notes
- originating Post/Service discovery context
- existing Conversation ID when the participants already have a direct thread

Server derives:
- client User
- Hustler owner from the Service's ProfessionalProfile
- currency and agreed price basis from the current published Service
- lifecycle timestamps

Self-booking should be rejected for the MVP.

## Historical transaction terms

Unlike a discovery card, a Booking is a transaction record. Some agreed terms must remain stable even if the Service changes later.

The Booking should preserve transaction-critical terms at request/acceptance, such as:
- agreed price in minor units
- currency
- pricing type
- requested schedule
- service title/reference label for audit readability

The canonical Service ID must still be retained.

This is a deliberate historical snapshot boundary, not a duplicate marketplace entity.

## Hustler decision

Only the booked Service owner with ACTIVE HUSTLER capability may accept or decline the request.

Acceptance should:
- record acceptance timestamp
- preserve/confirm schedule
- move the booking into the payment boundary for paid services

Decline should:
- record decision timestamp
- optionally capture a concise reason
- prevent later acceptance without an explicit new booking/request flow

## Scheduling and availability

Phase 11 owns concrete booking scheduling.

MVP scheduling uses explicit requested/confirmed date-time values. It does not require a sophisticated calendar engine before real usage proves the need.

Avoid pretending that an availability note on a Service is real-time availability. The actual Booking record is authoritative for the agreed scheduled time.

Conflict detection may begin with simple overlapping active-booking checks for the same Hustler. Calendar integrations and advanced recurring availability are later evolutions.

## Messaging relationship

Messaging already exists independently.

Booking should connect to the existing direct conversation between the Client and Hustler rather than create a separate messaging identity.

A Booking context can be added to Message context once the Booking domain exists.

Expected path:

`Service → Book → Booking created → existing/new direct Conversation → Booking context available in chat`

The Booking record remains authoritative for status; chat text does not change Booking state.

## Authorization

Client may:
- create a Booking
- read Bookings where they are the client
- cancel only when lifecycle rules permit
- later confirm completion where the product flow requires it

Hustler may:
- read Bookings for Services they own
- accept/decline pending requests
- start work only when lifecycle rules allow
- mark work complete through an explicit transition

Other users must not access the Booking.

All lifecycle transitions are server-side authorization decisions.

## Observability

Minimum Phase 11 events:
- `booking.requested`
- `booking.accepted`
- `booking.declined`
- `booking.cancelled`
- `booking.payment_pending`
- `booking.funded` (only from authoritative Phase 13 integration)
- `booking.started`
- `booking.completed`
- `booking.disputed`
- `booking.refunded`
- `booking.closed`

Event payloads use IDs, status, actor role/capability context, and non-sensitive transition metadata. Do not place private job requirements or message text in SystemEvent payloads.

Discovery/feed instrumentation may later connect booking conversion back to originating content/service surfaces.

## Experience requirements

At every stage show:
- current status
- who needs to act next
- scheduled time
- Service reference
- agreed price/currency
- the next valid action

Examples:

`REQUESTED → Waiting for Hustler response`

`PAYMENT_PENDING → Accepted. Payment is required before work begins.`

`IN_PROGRESS → Work is active.`

`COMPLETED → Work marked complete; later review/payment settlement rules may apply.`

The UI must prioritize clarity before complexity.

## Phase 11 boundaries

Phase 11 owns:
- booking request
- scheduling
- requirements
- explicit lifecycle
- accept/decline
- cancellation rules
- booking history/detail
- participant authorization
- booking/message linkage
- transition observability

Phase 12 owns Product Cart + Orders.

Phase 13 owns:
- payment gateway
- transaction ledger
- escrow
- authoritative FUNDED state trigger
- refunds
- payout
- reconciliation
- webhooks/idempotency

Phase 14 owns verified transaction reviews/reputation and broader dispute/trust policy.

Phase 19 owns administrative booking oversight tooling.

Phase 20 owns the full notification product.

## Phase 11 build slices

### 11A — Booking data foundation
- Booking model + enums
- transaction-critical snapshot fields
- client/Hustler/Service relationships
- optional Conversation relationship
- lifecycle timestamps
- indexes, constraints, RLS/API-role policies

### 11B — Booking API + transition engine
- create booking request
- list client bookings
- list Hustler bookings
- get booking detail
- accept / decline
- cancel
- start / complete lifecycle transitions under allowed conditions
- payment-boundary transition contract
- booking events

### 11C — Booking web experience
- Service → Book CTA
- booking request form
- `/bookings`
- booking detail
- client/Hustler action surfaces in one unified account context
- explicit next-action/status display
- message thread link

### 11D — Scheduling + conflict validation
- simple overlap/conflict checks
- schedule confirmation/change rules
- failure states

### 11E — Real gate
Use real `adminxpen` CLIENT and `xpen` HUSTLER with the existing published Service.

Validate:
1. Client can request a real Service with date/time + requirements.
2. Same Service owner receives the request.
3. Unauthorized third party cannot read/mutate it.
4. Hustler can accept/decline according to state.
5. Paid booking reaches `PAYMENT_PENDING` without fake funding.
6. Booking status/history persists after refresh/sign-out/sign-in.
7. Messaging can reference/open the Booking once context support is wired.
8. Duplicate/invalid transitions are rejected.
9. Scheduling conflicts are explicit.
10. Capabilities remain unchanged.

Integrated paid-service completion through `FUNDED → IN_PROGRESS → COMPLETED` becomes the Phase 11+13 transaction gate once real sandbox payment/escrow is available.
