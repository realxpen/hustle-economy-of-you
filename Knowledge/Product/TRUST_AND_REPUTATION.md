# Trust + Reputation

Status: CANONICAL — Phase 14 ACTIVE
Updated: 2026-09-15

## Purpose

Phase 14 turns verified Hustle transactions into durable **provider reputation** while keeping **counterparty trust/safety intelligence** as a distinct system.

Canonical public-reputation loop:

`Verified transaction → Client/Buyer review eligibility → Rating + written review → Verified provider review → Trust signals → Hustler/Seller reputation → Better opportunity`

Canonical counterparty-safety loop:

`Meaningful transaction interaction → Hustler/Seller private feedback → behavioural + report signals → Admin trust/safety intelligence → safer future transactions`

Trust is downstream of real activity. A browser, profile owner or arbitrary API caller must never be able to manufacture verified reputation or trust/safety evidence.

## Trust authority

Trust evidence has different sources and must not be collapsed into one badge or score:

- identity verification proves an identity/application check
- transaction verification proves Hustle observed a real paid transaction reach a reviewable completion state
- verified public reviews capture customer experience with a provider after that transaction
- provider reputation aggregates durable provider-review evidence
- private counterparty feedback captures provider experience with a Client/Buyer
- reports capture serious safety, fraud, abuse or policy concerns
- behavioural signals come from authoritative platform events such as cancellations, disputes, refunds and transaction history

A verified identity does not imply a successful transaction. A successful transaction does not automatically imply positive reputation. One subjective complaint must not automatically create punishment.

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

Self-review remains forbidden even if malformed transaction data were ever to point both sides at the same User.

## Private counterparty trust — canonical decision

Hustle **does** support reciprocal trust input from providers, but it is intentionally separated from public provider reputation.

Private feedback direction:

Booking:
- `HUSTLER → CLIENT`

Order:
- `SELLER → BUYER`

This feedback is for Hustle trust/safety and Admin intelligence. It does **not** create a public Client/Buyer star rating and must not contribute to `UserReputation`.

### Private feedback purpose

It answers a different question from public provider reviews:

- public provider review: **“Should I hire or buy from this provider?”**
- private counterparty feedback: **“Was this Client/Buyer safe and reasonable to work with?”**

### Planned private feedback fields

Phase 14D should support a structured form such as:

- would work with this Client/Buyer again: `YES | NO`
- experience rating: integer `1..5` for internal use only
- issue categories, including:
  - no-show
  - abusive behaviour
  - scope manipulation
  - repeated cancellation
  - fraud / suspicious behaviour
  - delivery dispute abuse
  - communication problems
  - other
- private note
- transaction subject + state snapshot
- createdAt

Exact enum names may be finalized during the Phase 14D schema pass, but the separation from public `Review` is binding.

### Eligibility for private feedback

Unlike public provider reviews, private counterparty feedback may be useful after meaningful terminal or risk outcomes, not only successful completion.

Potential eligible transaction states include:

- `COMPLETED`
- `CANCELLED`
- `REFUNDED`
- `DISPUTED`

Phase 14D must define precise state-specific rules and participant authority before implementation.

This is necessary because a bad actor may cause a transaction to end before successful completion; requiring `COMPLETED` only would erase important safety evidence.

### Trust/safety use

Private counterparty feedback may contribute to Admin-facing risk context alongside authoritative behavioural signals such as:

- completed transaction count
- cancellation rate
- dispute rate
- refund rate
- account age
- payment behaviour
- response behaviour
- number/pattern of provider complaints
- moderated reports

It must not silently become a public Buyer/Client reputation score.

### Safety against abuse

One provider complaint must not automatically punish a Client/Buyer.

Admin or automated enforcement should require appropriate evidence, such as:

- repeated patterns across transactions
- corroborated reports
- authoritative platform behaviour
- moderation review
- severity of the reported event

Subjective feedback and objective system truth must remain distinguishable.

## Reports — separate from feedback

Reports are a distinct trust/safety mechanism and may be submitted by either side for serious problems such as:

- harassment
- fraud/scam
- threats
- fake identity
- payment abuse
- prohibited goods/services
- spam
- off-platform manipulation
- other policy/safety issues

Reports must be available where appropriate even if the transaction never reaches normal completion.

Reports feed moderation workflows; they do not directly alter public provider ratings.

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

Cancelled, unpaid, declined, pending or in-progress transactions are not publicly reviewable.

These states may still become eligible for **private counterparty trust feedback or reports** under Phase 14D rules.

## One public review per eligible transaction

Uniqueness is enforced by:

`(subjectType, subjectId, reviewerUserId)`

Because the MVP has one eligible public reviewer side per transaction, this creates at most one verified public review per Booking or Order while still retaining a durable reviewer identity in the key.

## Review content

MVP public review payload:

- overall rating: integer `1..5`
- written review: `10..2000` characters
- transaction subject
- reviewer/reviewee derived roles
- verified transaction marker + verification timestamp
- moderation status

### Rating dimensions

Phase 14 begins with one overall public provider rating.

Do not introduce arbitrary public sub-ratings before real usage demonstrates which dimensions matter.

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

Phase 14D will add moderation workflows and compensating reputation updates.

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

Only `PUBLISHED`, verified **received provider reviews** contribute to this projection. Hidden/removed reviews must be excluded or compensated transactionally.

The durable `Review` rows remain authoritative; reputation can be rebuilt from them.

Client/Buyer public reputation is out of MVP scope.
Private counterparty feedback must use a distinct model/read path and must not update `UserReputation`.

## Database authority

The `Review_role_pair` database constraint permits only:

- `CLIENT → HUSTLER`
- `BUYER → SELLER`

The corrective migration `20260915103000_phase14a_one_way_review_authority` removes the previously over-broad reverse role pairs without rewriting applied migration history.

Provider-to-customer private trust feedback must therefore use a separate Phase 14D model instead of reusing `Review`.

## Review privacy and access

Eligibility is authenticated and participant-scoped.

A non-participant cannot use the eligibility endpoint to inspect arbitrary private Booking/Order relationships.

Provider-side participants may receive the authoritative `REVIEWER_ROLE_NOT_ELIGIBLE` API result, but the web product does not render a public-review card for that result.

Review and reputation tables are API-role/server-controlled under RLS. Browser/mobile clients do not write them directly.

Private counterparty feedback and reports must also be server-controlled and visible only to authorized trust/safety/admin surfaces unless an explicit product decision says otherwise.

## API — Phase 14A/14B

Public review endpoints include:

- `GET /api/v1/reviews/eligibility/:subjectType/:subjectId`
- `POST /api/v1/reviews`
- given-review history
- received-provider review history
- public review detail/read model
- provider reputation read model

The client may submit only the approved public review payload. Reviewee identity, verified status and reputation mutation remain server-derived.

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

### 14D — Counterparty Trust + Reports + Blocking + Moderation
Build:
- `HUSTLER → CLIENT` private counterparty feedback
- `SELLER → BUYER` private counterparty feedback
- would-work-again signal
- internal experience rating
- structured issue categories + private notes
- transaction-state-aware feedback eligibility
- behavioural trust signals
- reports available to either side for serious safety/policy problems
- blocking
- Admin trust/safety read models
- moderation state transitions for public reviews/reports/feedback
- compensating provider-reputation updates when public reviews are hidden/removed
- objective platform behaviour kept separate from subjective reports/feedback

### 14E — Trust experience + runtime gate
Validate:
- Client can review Hustler only after eligible Booking completion/release
- Buyer can review Seller only after eligible Order completion
- Hustler/Seller public-review eligibility is rejected and no public review UI is shown
- Hustler/Seller can submit only approved private counterparty feedback through the Phase 14D flow
- early/unpaid/refunded/disputed/self/duplicate public-review attempts fail safely
- review creation cannot choose another reviewee
- private feedback cannot alter `UserReputation`
- reports do not directly alter public ratings
- hidden/removed public review does not corrupt aggregates
- provider reputation can be rebuilt from durable reviews
- profile surfaces match server truth
- Admin trust/safety surfaces distinguish reports, private feedback and objective behavioural signals

## Phase 14A gate

Phase 14A passes when:

1. migrations apply successfully
2. Prisma generates/typechecks/builds
3. completed released Booking returns `ELIGIBLE` for the Client
4. the same Booking returns `REVIEWER_ROLE_NOT_ELIGIBLE` for the Hustler and renders no public review card
5. completed paid Order returns `ELIGIBLE` for the Buyer
6. the same Order returns `REVIEWER_ROLE_NOT_ELIGIBLE` for the Seller and renders no public review card
7. refunded/disputed/incomplete subject returns ineligible
8. non-participant access is forbidden
9. no browser/API path exists to directly mark a review verified

Do not begin reputation ranking effects until the review system itself is runtime-validated.
