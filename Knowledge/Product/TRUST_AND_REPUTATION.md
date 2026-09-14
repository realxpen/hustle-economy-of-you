# Trust + Reputation

Status: CANONICAL — Phase 14 ACTIVE
Updated: 2026-09-14

## Purpose

Phase 14 turns completed Hustle transactions into durable trust.

Canonical loop:

`Verified transaction → Review eligibility → Rating + written review → Verified review → Trust signals → Profile reputation → Better opportunity`

Trust is downstream of real activity. A browser, profile owner or arbitrary API caller must never be able to manufacture verified reputation.

## Trust authority

Trust evidence has different sources and must not be collapsed into one badge:

- identity verification proves an identity/application check
- transaction verification proves Hustle observed a real paid transaction reach a reviewable completion state
- reviews capture counterpart experience after that verified transaction
- reputation aggregates durable review evidence
- later behavioural signals may complement reviews but must remain separately attributable

A verified identity does not imply a successful transaction. A successful transaction does not automatically imply a five-star reputation.

## Review subjects

MVP reviews attach only to transaction subjects:

- `BOOKING`
- `ORDER`

No free-floating profile review is allowed.

This prevents unverified testimonials from being mixed into verified transaction reputation.

## Who can review whom

Booking:
- Client → Hustler
- Hustler → Client

Order:
- Buyer → Seller
- Seller → Buyer

The reviewee is derived from the canonical transaction participants. The client never submits an arbitrary reviewee ID.

Self-review is forbidden even if malformed transaction data were ever to point both roles at the same User.

## Server-authoritative review eligibility

### Booking

A Booking is reviewable only when all are true:

1. requester is the Booking Client or Hustler
2. Booking is `COMPLETED` or `CLOSED`
3. `completedAt` exists
4. an authoritative `PaymentAttempt` exists for the Booking with `SUCCEEDED` + `domainAppliedAt`
5. matching Booking escrow is `RELEASED` with `releasedAt`
6. Booking is not `REFUNDED`
7. Booking is not `DISPUTED`
8. requester has not already reviewed this Booking
9. reviewer and reviewee are different Users

Why escrow release is required: the Hustler marking work complete alone is not enough. Review eligibility begins only after the transaction has crossed the payment + completion + release boundary.

### Order

An Order is reviewable only when all are true:

1. requester is the Order Buyer or Seller
2. Order is `COMPLETED`
3. `completedAt` exists
4. an authoritative `PaymentAttempt` exists for the Order with `SUCCEEDED` + `domainAppliedAt`
5. Order is not `REFUNDED`
6. requester has not already reviewed this Order
7. reviewer and reviewee are different Users

`DELIVERED` alone does not unlock review. The buyer-confirmed `COMPLETED` state is the review boundary.

## Refunded, disputed and cancelled transactions

Refunded transactions are not reviewable in the MVP trust score.

Disputed Bookings are not reviewable while disputed. A later dispute-resolution model may introduce a dedicated resolution path, but Phase 14A must not guess one.

Cancelled, unpaid, declined, pending or in-progress transactions are not reviewable.

## One review per side per transaction

Uniqueness is enforced by:

`(subjectType, subjectId, reviewerUserId)`

This allows both sides of the same transaction to review while preventing duplicate reviews from one participant.

## Review content

MVP review payload:

- overall rating: integer `1..5`
- written review: `10..2000` characters
- transaction subject
- reviewer/reviewee derived roles
- verified transaction marker + verification timestamp
- moderation status

### Rating dimensions

Phase 14 begins with one overall rating.

Do not introduce arbitrary sub-ratings before real usage demonstrates which dimensions matter. Later dimensions may differ for provider/seller and client/buyer relationships, so adding them prematurely would hard-code an unvalidated trust model.

## Editing policy

Published reviews are immutable in the MVP.

Reason:
- review evidence should remain auditable
- silent post-publication rewrites can distort reputation history
- no edit endpoint should exist until a versioned review-history design is approved

A future version may support a short edit window only if every revision is retained.

## Deletion and moderation policy

Authors do not hard-delete verified reviews.

Moderation state:
- `PUBLISHED` — contributes to visible reputation
- `HIDDEN` — temporarily excluded from public/reputation surfaces
- `REMOVED` — removed by moderation policy while retaining the durable audit record

Phase 14A creates the states but does not expose moderation mutation endpoints yet.

## Verified transaction badge

`verifiedTransaction=true` is server-derived only.

It means the review is backed by a transaction that passed the eligibility rules at creation time.

The browser cannot request or toggle verification.

## Reputation projection

`UserReputation` is a rebuildable projection, not the primary evidence source.

Canonical counters:
- `ratingSum`
- `reviewCount`
- `verifiedReviewCount`
- `bookingReviewCount`
- `orderReviewCount`
- `lastReviewAt`

Average rating is derived as:

`ratingSum / reviewCount`

Do not store a floating-point average as the source of truth.

Only `PUBLISHED`, verified received reviews should contribute when Phase 14B begins maintaining the projection. Hidden/removed reviews must be excluded or compensated transactionally.

The durable `Review` rows remain authoritative; reputation can be rebuilt from them.

## Review privacy and access

Eligibility is authenticated and participant-scoped.

A non-participant cannot use the eligibility endpoint to inspect arbitrary private Booking/Order relationships.

Review and reputation tables are API-role/server-controlled under RLS. Browser/mobile clients do not write them directly.

## API — Phase 14A

Authenticated eligibility endpoint:

`GET /api/v1/reviews/eligibility/:subjectType/:subjectId`

The endpoint returns:
- eligible boolean
- reason code + message
- whether the transaction is verified for review purposes
- reviewer role
- server-derived reviewee identity + role
- existing review reference when the reviewer has already submitted one

Eligibility does not create a review.

## Phase 14 build slices

### 14A — Trust model foundation
Build:
- canonical trust rules
- Review + UserReputation schema
- database constraints/RLS
- server-authoritative review eligibility
- ADR documenting verified-transaction authority

### 14B — Review creation + read models
Build:
- create verified review
- transactional reputation projection update
- received/given review lists
- public review detail/read model
- exact duplicate/race protection

### 14C — Profile reputation
Build:
- average rating + review count surfaces
- verified review badge
- received/given profile tabs
- service/product context in review cards
- trust summary for search/discovery consumption

### 14D — Moderation + trust signals
Build:
- moderation state transitions
- safe report/review workflow
- compensating reputation updates
- identity + transaction + behavioural trust signals kept distinct

### 14E — Trust experience + runtime gate
Validate:
- both sides can review only after eligible completion
- early/unpaid/refunded/disputed/self/duplicate review attempts fail safely
- review creation cannot choose another reviewee
- hidden/removed review does not corrupt aggregates
- reputation can be rebuilt from durable reviews
- profile surfaces match server truth

## Phase 14A gate

Phase 14A passes when:

1. migration applies successfully
2. Prisma generates/typechecks/builds
3. completed released Booking returns `ELIGIBLE` for each participant before either reviews it
4. completed paid Order returns `ELIGIBLE` for each participant before either reviews it
5. refunded/disputed/incomplete transaction returns ineligible
6. non-participant access is forbidden
7. no browser/API path exists to directly mark a review verified

Do not begin reputation ranking effects until the review system itself is runtime-validated.
