# ADR-0017 — Verified review creation and reputation projection

Status: Accepted
Date: 2026-09-15

## Decision

Phase 14B creates public provider reviews only from server-verified transaction evidence.

The browser submits only:

- `subjectType`
- `subjectId`
- `rating`
- `body`

The browser does **not** submit or control:

- reviewee identity
- reviewer/reviewee roles
- verified-transaction status
- moderation status
- reputation counters
- average rating

## Creation authority

Every `POST /api/v1/reviews` request re-validates the canonical transaction inside the same serializable database transaction that creates the Review.

Booking requires:

- requester is the Client
- completed/closed state with `completedAt`
- authoritative succeeded/applied payment
- released escrow
- not refunded
- not disputed
- no self-review

Order requires:

- requester is the Buyer
- completed state with `completedAt`
- authoritative succeeded/applied payment
- not refunded
- no self-review

Provider-side callers are rejected even if the browser is modified.

## Atomic reputation update

Review creation and `UserReputation` mutation are one database transaction.

For every new `PUBLISHED` verified review, the provider projection increments:

- `ratingSum`
- `reviewCount`
- `verifiedReviewCount`
- the matching Booking or Order review count
- `lastReviewAt`

`averageRating` remains derived as `ratingSum / reviewCount`; it is not stored as primary truth.

If review creation fails, reputation does not change. If reputation mutation fails, the Review does not persist.

## Duplicate and race protection

The database unique key `(subjectType, subjectId, reviewerUserId)` is the final duplicate authority.

The service also checks for an existing review for a clearer error, but the unique key protects concurrent submissions.

Duplicate submissions return a conflict and never increment reputation twice.

Serializable transaction conflicts are retried once; unresolved contention fails safely and asks the caller to refresh.

## Content policy

MVP review payload:

- rating: integer `1..5`
- written body: trimmed `10..2000` characters

Published reviews are immutable during the MVP. Editing is not exposed.

## Read models

Phase 14B provides:

- review detail
- signed-in user's given-review history
- provider's published received reviews
- provider reputation projection

Received review lists expose only `PUBLISHED` reviews.

## Frontend behavior

Eligible transaction pages show the review form.

After successful submission:

- the form disappears
- the published rating/body is rendered immediately
- reload resolves the existing Review and renders it instead of another form

Provider-side transaction pages do not render a public review surface.
