# ADR-0019 — Public provider trust summary

Status: Accepted
Date: 2026-09-15

## Decision

Hustle exposes one server-authoritative public provider trust-summary contract for published Hustler identities:

`GET /api/v1/trust/users/:userId/summary`

The contract returns:

- provider identity needed to bind the trust result to a User;
- the exact `UserReputation` projection with server-derived `averageRating`;
- a verified-review trust marker;
- the latest `PUBLISHED`, `verifiedTransaction=true` received provider reviews;
- transaction context for each review (Service or Product Order).

The endpoint is public only for Users who currently have both:

- an ACTIVE `HUSTLER` capability; and
- a PUBLISHED professional profile.

## Why

Profile, Search, Marketplace and future discovery/ranking surfaces need the same trust facts. Recalculating rating averages or review counts independently in browsers would create multiple sources of truth.

This contract makes the API the single projection boundary for public provider reputation.

## Public/private boundary

The public summary includes only public provider reputation evidence:

- `CLIENT → HUSTLER` Booking reviews;
- `BUYER → SELLER` Order reviews;
- `PUBLISHED` reviews;
- verified transaction-backed reviews.

It must not expose:

- Phase 14D private Hustler→Client / Seller→Buyer feedback;
- reports;
- moderation notes;
- hidden or removed reviews;
- internal risk signals;
- Admin trust/safety intelligence.

## Browser rule

The browser renders the values returned by this contract. It must not derive a new rating average, verified-review count or reputation score from review-card data.

## Profile experience

A published Hustler profile may show:

- average rating;
- verified review count;
- Service review count;
- Product review count;
- verified-review marker;
- published review cards with transaction context.

A User with no verified reviews receives a neutral empty state, not a negative score.

Clients/Buyers do not receive a public star rating under this contract.

## Signed-in reviewer history

The existing authenticated `GET /api/v1/reviews/me/given` endpoint remains the source for a User's own given-review history. This is separate from the public provider trust summary.

## Consequences

- public reputation stays consistent across profile and discovery surfaces;
- future Search/Marketplace integrations can consume one API projection;
- moderation can remove a review from public surfaces without changing frontend logic;
- private counterparty trust remains structurally separate from provider reputation.
