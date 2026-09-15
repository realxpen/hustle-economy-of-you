# ADR-0018 — Private Counterparty Trust Is Separate From Public Provider Reputation

Status: Accepted
Date: 2026-09-15

## Decision

Hustle will maintain two distinct trust directions:

### Public provider reputation
- Booking: `CLIENT → HUSTLER`
- Order: `BUYER → SELLER`
- visible provider ratings/reviews
- contributes to `UserReputation`

### Private counterparty trust/safety
- Booking: `HUSTLER → CLIENT`
- Order: `SELLER → BUYER`
- internal/private trust feedback for Hustle Admin and trust/safety systems
- does **not** contribute to `UserReputation`
- does **not** create a public Client/Buyer star rating

Reports are a third, separate mechanism available to either side for serious safety, fraud, abuse or policy concerns.

## Why

Provider public reputation and counterparty risk answer different product questions:

- Public review: “Should I hire or buy from this provider?”
- Private counterparty feedback: “Was this Client/Buyer safe and reasonable to transact with?”

Combining both into the same Review/reputation model would make it easy for future ranking or recommendation systems to treat buyer risk feedback as professional marketplace reputation.

## Private feedback direction

Booking:
`HUSTLER → CLIENT`

Order:
`SELLER → BUYER`

Planned feedback may include:
- would work with again: yes/no
- internal experience rating
- structured issue categories
- private note
- transaction/status evidence

## Eligibility difference

Public reviews require verified successful completion according to the Phase 14A/14B rules.

Private counterparty feedback may be allowed after meaningful terminal/risk outcomes such as:
- COMPLETED
- CANCELLED
- REFUNDED
- DISPUTED

The precise state rules are a Phase 14D architecture decision.

This distinction is necessary because bad-actor behaviour can cause a transaction to fail before successful completion.

## Reports

Reports are separate from both public reviews and private counterparty feedback.

They may cover:
- harassment
- fraud/scam
- threats
- fake identity
- payment abuse
- prohibited goods/services
- spam
- off-platform manipulation
- other safety/policy issues

Reports may be available even when no normal transaction completion occurs.

## Enforcement principle

One subjective complaint must not automatically punish a user.

Trust/safety action should consider appropriate evidence such as:
- repeated cross-transaction patterns
- corroborated reports
- authoritative cancellation/dispute/refund behaviour
- severity
- moderation review

Objective platform evidence and subjective feedback must remain distinguishable.

## Data-model consequence

Do not reuse the public `Review` table for Hustler→Client or Seller→Buyer feedback.

Phase 14D must introduce a separate private feedback model/read path. The existing `Review_role_pair` constraint remains intentionally one-way:
- CLIENT → HUSTLER
- BUYER → SELLER

## Phase impact

Phase 14 remains:
- 14A — Trust Foundation — complete
- 14B — Verified Provider Reviews + Ratings — runtime validation
- 14C — Provider Reputation Projection / profile surfaces
- 14D — Counterparty Trust + Reports + Blocking + Moderation
- 14E — Full Trust Experience + Runtime Gate
