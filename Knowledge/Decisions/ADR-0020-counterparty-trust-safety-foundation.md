# ADR-0020 — Counterparty Trust + Safety Foundation

Status: Accepted
Date: 2026-09-15

## Decision

Hustle separates **public provider reputation** from **private counterparty trust and safety**.

Public provider reputation remains:

- Booking: `CLIENT → HUSTLER`
- Order: `BUYER → SELLER`

Private counterparty feedback is:

- Booking: `HUSTLER → CLIENT`
- Order: `SELLER → BUYER`

Private feedback never writes to or recalculates `UserReputation`.

## Counterparty feedback authority

Private feedback is transaction-backed and can be submitted only by the provider side of the transaction.

Booking feedback unlocks for the Hustler after these meaningful terminal outcomes:

- `COMPLETED`
- `CLOSED`
- `CANCELLED`
- `REFUNDED`
- `DISPUTED`

Order feedback unlocks for the Seller after:

- `COMPLETED`
- `CANCELLED`
- `REFUNDED`

The target user, roles and transaction status snapshot are derived server-side from the canonical Booking/Order. The client never supplies the feedback target.

One private feedback record is allowed per provider per transaction.

Private feedback can include:

- would work with this counterparty again: yes/no
- optional experience rating `1..5`
- issue categories
- optional private note
- immutable transaction status snapshot

The experience rating is **not** a public Client/Buyer star rating.

## Safety reports

Either transaction participant can report the other participant at **any transaction stage**. Reports do not wait for completion, cancellation or refund because serious abuse may happen before a transaction becomes terminal.

The report target is derived server-side from the transaction.

Supported categories:

- harassment
- fraud/scam
- threats
- fake identity
- payment abuse
- prohibited goods/services
- spam
- off-platform manipulation
- other

A reporter may submit one report per category per transaction. Reports begin `OPEN` and later Admin moderation may move them through `UNDER_REVIEW`, `ACTIONED` or `DISMISSED`.

Reporter-facing read models do not expose internal moderation notes.

## Blocking

Any authenticated Hustle user can block another existing Hustle user.

Rules:

- self-blocking is forbidden
- duplicate block requests are idempotent
- unblock is idempotent
- block state is private
- Phase 14D-C will enforce block effects across messaging/discovery/interaction surfaces

## Privacy boundary

These are private/internal data:

- `CounterpartyFeedback`
- `SafetyReport`
- `UserBlock`
- private notes
- moderation notes
- future trust/safety risk projections

They must not appear in:

- `/u/:username`
- public provider trust summaries
- public ratings/review counts
- Search/Marketplace reputation ranking as raw labels

Future Intelligence may consume aggregated safety signals only after an explicit policy decision and anti-abuse safeguards.

## Database authority

Database constraints enforce:

- no self feedback/report/block
- feedback role pair is only `BOOKING/HUSTLER→CLIENT` or `ORDER/SELLER→BUYER`
- feedback experience rating is null or `1..5`
- one feedback per author per transaction
- one report category per reporter per transaction

RLS is enabled on all three private trust/safety tables; browser/mobile clients do not write these tables directly.

## Observation

The API emits durable SystemEvents for:

- `trust.counterparty_feedback_submitted`
- `safety.report_submitted`
- `safety.user_blocked`
- `safety.user_unblocked`

These events support later Admin safety intelligence without mutating public reputation.
