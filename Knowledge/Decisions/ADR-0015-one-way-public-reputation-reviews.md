# ADR-0015 — One-way public reputation reviews

Status: Accepted
Date: 2026-09-15

## Decision

For the Hustle MVP, public transaction-backed reputation reviews flow only from demand-side users to providers:

- Booking: `CLIENT → HUSTLER`
- Order: `BUYER → SELLER`

Hustlers do not publicly rate Clients, and Sellers do not publicly rate Buyers, in Phase 14.

## Why

The Phase 14 MVP loop is specifically designed to turn verified customer outcomes into provider reputation:

`Verified transaction → Client/Buyer review → Hustler/Seller reputation → stronger future opportunity`

A broader future feedback system may collect reciprocal private feedback for trust, safety, abuse prevention, or operational quality, but that must not be mixed into the provider-facing public reputation model without a separate product decision.

## Authority

The rule is enforced at every layer:

1. eligibility service — provider-side callers receive `REVIEWER_ROLE_NOT_ELIGIBLE`;
2. review creation in Phase 14B must re-check the same authority server-side;
3. database constraint permits only `CLIENT → HUSTLER` and `BUYER → SELLER` Review rows;
4. frontend does not render a public review surface for provider-side callers.

Frontend visibility is not an authorization mechanism. The server and database remain authoritative.

## Consequences

- Public Hustler/Seller reputation is directly attributable to verified customer transactions.
- Client/Buyer public ratings are out of MVP scope.
- Received-review reputation projections apply to providers.
- Reciprocal feedback, if introduced later, should use a distinct model or explicitly approved reputation policy rather than silently reusing `Review`.
