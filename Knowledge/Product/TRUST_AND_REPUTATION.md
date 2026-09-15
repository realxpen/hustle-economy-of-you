# Trust + Reputation

Status: CANONICAL — Phase 14 ACTIVE
Updated: 2026-09-15

## Purpose

Phase 14 turns verified Hustle transactions into durable **provider reputation**.

Canonical MVP loop:

`Verified transaction → Client/Buyer review eligibility → Rating + written review → Verified provider review → Trust signals → Hustler/Seller reputation → Better opportunity`

Trust is downstream of real activity. A browser, profile owner or arbitrary API caller must never be able to manufacture verified reputation.

## Trust authority

Trust evidence has different sources and must not be collapsed into one badge:

- identity verification proves an identity/application check
- transaction verification proves Hustle observed a real paid transaction reach a reviewable completion state
- verified public reviews capture customer experience with a provider after that transaction
- reputation aggregates durable provider-review evidence
- later behavioural signals may complement reviews but must remain separately attributable

A verified identity does not imply a successful transaction. A successful transaction does not automatically imply positive reputation.

## Review subjects

MVP public reviews attach only to transaction subjects:

- `BOOKING`
- `ORDER`

No free-floating profile review is allowed.

This prevents unverified testimonials from being mixed into verified transaction reputation.

## Public review direction — MVP

Public reputation reviews are intentionally one-way in Phase 14:

Booking:
- `CLIENT → HUSTLER`

Order:
- `BUYER → SELLER`

Hustlers do **not** publicly rate Clients in the MVP.
Sellers do **not** publicly rate Buyers in the MVP.

The reviewee is derived from the canonical transaction participants. The client/browser never submits an arbitrary reviewee ID.

A future reciprocal feedback system may exist for private trust/safety, abuse prevention or operational quality, but it must be modeled separately or explicitly approved before it can affect public reputation.

Self-review remains forbidden even if malformed transaction data were ever to point both sides at the same User.

## Server-authoritative review eligibility

### Booking

A Booking is publicly reviewable only when all are true:

1. requester is the Booking `CLIENT`
2. Booking is `COMPLETED` or `CLOSED`
3. `completedAt` exists
4. an authoritative `PaymentAttempt` exists for the Booking with `SUCCEEDED` + `domainAppliedAt`
5. matching Booking escrow is `RELEASED` with `releasedAt`
6. Booking is not `REFUNDED`
7. Booking is not `DISPUTED`
8. requester has not already reviewed this Booking
9. reviewer and reviewee are different Users

If the requester is the Booking Hustler, the endpoint returns `REVIEWER_ROLE_NOT_ELIGIBLE` and public-review verification is false.

Why escrow release is required: the Hustler marking work complete alone is not enough. Review eligibility begins only after the transaction has crossed payment + completion + release boundaries.

### Order

An Order is publicly reviewable only when all are true:

1. requester is the Order `BUYER`
2. Order is `COMPLETED`
3. `completedAt` exists
4. an authoritative `PaymentAttempt` exists for the Order with `SUCCEEDED` + `domainAppliedAt`
5. Order is not `REFUNDED`
6. requester has not already reviewed this Order
7. reviewer and reviewee are different Users

If the requester is the Order Seller, the endpoint returns `REVIEWER_ROLE_NOT_ELIGIBLE` and public-review verification is false.

`DELIVERED` alone does not unlock review. Buyer-confirmed `COMPLETED` is the review boundary.

## Refunded, disputed and cancelled transactions

Refunded transactions are not reviewable in the MVP public reputation system.

Disputed Bookings are not reviewable while disputed. A later dispute-resolution model may introduce a dedicated resolution path, but Phase 14 must not guess one.

Cancelled, unpaid, declined, pending or in-progress transactions are not reviewable.

## One public review per eligible transaction

Uniqueness is enforced by:

`(subjectType, subjectId, reviewerUserId)`

Because the MVP has one eligible public reviewer side per transaction, this creates at most one verified public review per Booking or Order while still retaining a durable reviewer identity in the key.

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

Do not introduce arbitrary sub-ratings before real usage demonstrates which dimensions matter.

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

It means the review is backed by a transaction that passed the eligibility rules at review creation time.

The browser cannot request or toggle verification.

## Reputation projection

`UserReputation` is a rebuildable **provider reputation** projection, not the primary evidence source.

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

Only `PUBLISHED`, verified **received provider reviews** should contribute when Phase 14B begins maintaining the projection. Hidden/removed reviews must be excluded or compensated transactionally.

The durable `Review` rows remain authoritative; reputation can be rebuilt from them.

Client/Buyer public reputation is out of MVP scope.

## Database authority

The `Review_role_pair` database constraint permits only:

- `CLIENT → HUSTLER`
- `BUYER → SELLER`

The corrective migration `20260915103000_phase14a_one_way_review_authority` removes the previously over-broad reverse role pairs without rewriting applied migration history.

## Review privacy and access

Eligibility is authenticated and participant-scoped.

A non-participant cannot use the eligibility endpoint to inspect arbitrary private Booking/Order relationships.

Provider-side participants may receive the authoritative `REVIEWER_ROLE_NOT_ELIGIBLE` API result, but the web product does not render a public-review card for that result.

Review and reputation tables are API-role/server-controlled under RLS. Browser/mobile clients do not write them directly.

## API — Phase 14A

Authenticated eligibility endpoint:

`GET /api/v1/reviews/eligibility/:subjectType/:subjectId`

The endpoint returns:
- eligible boolean
- reason code + message
- whether the transaction is verified for public-review purposes
- reviewer role
- server-derived reviewee identity + role
- existing review reference when the eligible reviewer has already submitted one

Eligibility does not create a review.

## Phase 14 build slices

### 14A — Trust model foundation
Build:
- canonical trust rules
- Review + UserReputation schema
- database constraints/RLS
- server-authoritative review eligibility
- frontend eligibility surface
- one-way provider-reputation authority

### 14B — Review creation + read models
Build:
- create verified Client→Hustler / Buyer→Seller review
- re-check eligibility during creation; never trust browser eligibility state
- transactional provider-reputation projection update
- received provider review lists
- reviewer-given review history for the Client/Buyer
- public review detail/read model
- exact duplicate/race protection

### 14C — Profile reputation
Build:
- average rating + review count surfaces
- verified review badge
- provider received reviews
- reviewer given-review history
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
- Client can review Hustler only after eligible Booking completion/release
- Buyer can review Seller only after eligible Order completion
- Hustler/Seller public-review eligibility is rejected and no public review UI is shown
- early/unpaid/refunded/disputed/self/duplicate attempts fail safely
- review creation cannot choose another reviewee
- hidden/removed review does not corrupt aggregates
- provider reputation can be rebuilt from durable reviews
- profile surfaces match server truth

## Phase 14A gate

Phase 14A passes when:

1. migrations apply successfully
2. Prisma generates/typechecks/builds
3. completed released Booking returns `ELIGIBLE` for the Client
4. the same Booking returns `REVIEWER_ROLE_NOT_ELIGIBLE` for the Hustler and renders no public review card
5. completed paid Order returns `ELIGIBLE` for the Buyer
6. the same Order returns `REVIEWER_ROLE_NOT_ELIGIBLE` for the Seller and renders no public review card
7. refunded/disputed/incomplete transactions return ineligible for eligible-side reviewers
8. non-participant access is forbidden
9. no browser/API path exists to directly mark a review verified

Do not begin reputation ranking effects until the review system itself is runtime-validated.
