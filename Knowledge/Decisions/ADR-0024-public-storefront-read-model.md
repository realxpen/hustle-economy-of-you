# ADR-0024 — Public Storefront Read Model

Status: Accepted
Date: 2026-09-16

## Context

Hustle already has authoritative public identity, services, products, posts and verified provider reputation. Phase 15 must turn those existing systems into a useful public storefront without creating a second profile, a second seller identity, or manually duplicated storefront content.

A browser-only composition of many unrelated public endpoints would make the public experience fragile and would encourage duplicated eligibility/filter rules in the client.

## Decision

Phase 15 introduces a public server-side storefront read model exposed by username.

The storefront read model:

1. resolves one published ProfessionalProfile owned by an ACTIVE HUSTLER capability;
2. includes only PUBLISHED Services, Products and Posts;
3. reuses the existing PublicTrustService for verified public reputation instead of rebuilding trust logic;
4. excludes private counterparty feedback, reports, blocks, moderation notes and Admin intelligence;
5. exposes safe public social proof such as follower and published-content counts;
6. derives inventory display from authoritative Product/Variant inventory fields;
7. exposes no private authentication, financial, payout or safety data;
8. remains read-only and available without a Hustle session.

Canonical API:

`GET /api/v1/storefronts/:username`

Canonical web route remains:

`/u/:username`

The web route evolves from public professional profile into public Hustle storefront. It does not create a new account, role, slug system or manually maintained website identity.

## Storefront composition

The storefront may render:

- identity + professional profile;
- capability and experience information;
- public Services with Book paths;
- public Products with Buy paths;
- published Posts as proof/work;
- verified public reputation;
- safe public counts and follower count;
- Message, Share and Copy-link actions.

Later Phase 15 distribution work may add canonical social metadata and QR rendering, but those features must continue to represent this same authoritative `/u/:username` storefront URL.

## Consequences

- Signed-out visitors get one coherent public representation of a Hustler.
- Storefront content updates automatically when the underlying Hustle data changes.
- Paused/draft offers and private safety signals cannot leak through client-side filtering mistakes.
- Public reputation remains governed by the already validated trust system.
- The storefront can become a distribution surface without becoming a separate website-builder product.
