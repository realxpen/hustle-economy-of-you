# ADR-0013 — Verified transaction reviews and reputation authority

Status: Accepted
Date: 2026-09-14

## Context

Hustle Phase 13 now provides authoritative transaction truth for Bookings and Orders. Phase 14 must turn completed transactions into reputation without allowing profile owners or browser clients to manufacture social proof.

We need one review architecture that works across Services and Products while preserving the existing domain ownership boundaries:

- Booking owns service-work lifecycle
- Order owns commerce fulfillment lifecycle
- Phase 13 owns payment/escrow/refund authority
- Phase 14 owns review eligibility and reputation derived from those verified outcomes

## Decision

### 1. Reviews require a real transaction subject

MVP reviews may reference only:
- `BOOKING`
- `ORDER`

Free-floating profile testimonials are not mixed into verified review reputation.

### 2. Review eligibility is server-authoritative

The browser may ask whether a transaction is reviewable, but the server derives eligibility from durable transaction + payment state.

Booking eligibility requires completed work, authoritative applied payment and released escrow.

Order eligibility requires buyer-confirmed completion and authoritative applied payment.

Refunded, disputed, cancelled, unpaid and incomplete transactions are not reviewable.

### 3. Counterparty identity is derived from the transaction

Booking:
- Client reviews Hustler
- Hustler reviews Client

Order:
- Buyer reviews Seller
- Seller reviews Buyer

The client never submits an arbitrary reviewee user ID.

### 4. Self-review is forbidden

The review layer rejects a transaction whose reviewer and derived reviewee are the same User.

The database also enforces this invariant.

### 5. One review per reviewer per transaction

Unique key:

`(subjectType, subjectId, reviewerUserId)`

Both transaction sides may review independently, but one participant cannot create duplicates.

### 6. Verified transaction status is not client-editable

A review's verified-transaction marker is created from server-authoritative eligibility only.

The database requires review rows to remain verified transaction reviews in the MVP.

### 7. MVP uses one overall rating

Rating is an integer from 1 to 5 plus a written review.

Sub-ratings are deferred until usage validates which dimensions matter for Services, Products, Clients and Sellers.

### 8. Published reviews are immutable in the MVP

There is no author edit endpoint in Phase 14 foundation.

Future editing, if introduced, must preserve version history rather than silently rewriting trust evidence.

### 9. Reviews are moderated, not hard-deleted

Review status is:
- `PUBLISHED`
- `HIDDEN`
- `REMOVED`

Moderation may hide/remove a review from visible reputation later while retaining the durable audit row.

### 10. Reputation is a rebuildable projection

`Review` rows are durable evidence.

`UserReputation` stores exact counters such as rating sum and review count. Average rating is derived rather than stored as mutable floating-point truth.

If projection state is ever questioned, it must be possible to rebuild it from durable eligible reviews.

### 11. Identity verification and transaction reputation remain distinct

Identity/application verification is not a substitute for transaction reputation.

Likewise, a verified transaction review does not imply identity verification beyond what the identity system separately proves.

### 12. Trust data is server-controlled

Review and reputation tables use RLS and API-role access. Browser/mobile clients do not directly write trust records.

## Consequences

### Positive
- fake profile reviews cannot enter verified reputation
- both Services and Products share one trust model
- reviews are tied to auditable economic activity
- duplicate/self-review abuse is blocked in both service and database layers
- average rating can be rebuilt exactly from durable evidence
- future discovery ranking can consume trustworthy reputation signals

### Tradeoffs
- users cannot leave reviews for off-platform work in the verified score
- escrow release is required before service review eligibility
- review editing is intentionally unavailable until versioning exists
- moderation requires compensating reputation logic in a later Phase 14 slice

## Rejected alternatives

### Allow any logged-in user to review any profile
Rejected because it manufactures unverifiable social proof and makes reputation easy to game.

### Let the frontend submit the reviewee ID
Rejected because the transaction itself already defines the counterparty and must remain authoritative.

### Unlock Booking reviews when the Hustler presses Complete
Rejected because work-complete alone does not prove the Client accepted/released the escrow boundary.

### Unlock Order reviews at Delivered
Rejected because buyer-confirmed `COMPLETED` is the stronger transaction-completion boundary.

### Include refunded transactions in normal reputation
Rejected for the MVP because the economic transaction was reversed and dispute/refund semantics need a dedicated future policy.

### Store averageRating as the primary mutable value
Rejected because it creates drift and weakens rebuildability. Exact `ratingSum/reviewCount` counters are preferred.
