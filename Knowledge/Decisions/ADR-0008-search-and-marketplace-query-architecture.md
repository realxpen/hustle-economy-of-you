# ADR-0008 — Search and Marketplace Query Architecture

Status: Accepted
Date: 2026-09-09

## Context

Phase 8 proved passive discovery through the Home feed. Phase 9 adds intentional discovery: a user has a concrete need and expects Hustle to translate that intent into useful People, Posts, Services and Products.

The approved Hustle source defines MVP Search tabs as Top, People, Posts, Services and Products, with later surfaces for Live, Stories, Training, Requests and Map. It also defines Marketplace as a central browsing surface for Services, Products and later Apprenticeships/Training.

Hustle's architecture must preserve the ability to evolve toward structured search, text search, semantic search, location, availability, reputation and personalization without duplicating canonical domain data or prematurely introducing opaque AI ranking.

## Decision

Phase 9 will implement Search and Marketplace as server-side read models assembled from existing canonical PostgreSQL records.

Canonical ownership remains:

- `User → ProfessionalProfile`
- `ProfessionalProfile → Post`
- `ProfessionalProfile → Service`
- `ProfessionalProfile → Product`

Search does not create a second Person, Post, Service or Product source of truth.

## MVP result types

Search supports:
- Top
- People
- Posts
- Services
- Products

Marketplace supports browse-mode results for:
- All
- Services
- Products

Later result types remain absent until their owning phases exist.

## Public eligibility

Every search result must pass the same public-eligibility rules used by existing public pages and discovery:

- People: ProfessionalProfile PUBLISHED + HUSTLER ACTIVE
- Posts: Post PUBLISHED + ProfessionalProfile PUBLISHED + HUSTLER ACTIVE
- Services: Service PUBLISHED + ProfessionalProfile PUBLISHED + HUSTLER ACTIVE
- Products: Product PUBLISHED + ProfessionalProfile PUBLISHED + HUSTLER ACTIVE

Search never bypasses domain publication/capability state.

## Initial query engine

The first implementation uses PostgreSQL-backed lexical/structured matching through the existing NestJS modular monolith and Prisma boundary.

Ranking is deterministic and inspectable.

Signals may include:
- exact identity/title match
- exact phrase match
- prefix match
- token match
- category/skill match
- normalized textual location match
- verified identity
- recency
- modest interaction evidence
- current economic context

The ranking weights are ordinary auditable server code/configuration.

No ML model, vector index or external search engine is required to prove the Phase 9 gate.

## Top result merge

Each result type calculates a type-appropriate relevance score. The Top tab merges a bounded number of eligible results using normalized scores and deterministic tie-breaking.

This prevents one type from dominating merely because it has more text columns.

## Filters

Only filters backed by current authoritative data may become functional UI controls.

Supported current foundations include:
- category
- skill
- location
- nearby through normalized textual location matching
- Service/Product price range
- verified identity
- Service delivery mode
- Product type

Rating filtering is deferred until Phase 14 produces authoritative reviews/ratings.

Real-time Service availability filtering is deferred until Phase 11 owns booking/calendar state. Phase 9 may use the current availability note as descriptive data, not as proof of an open time slot.

## Pagination

Search and Marketplace endpoints use deterministic cursor pagination.

Stable ordering must include:

`relevance score → relevant timestamp → canonical ID`

The API must use bounded query/result windows and must not return the entire marketplace at once.

## Instrumentation

Search/Marketplace observation continues using `SystemEvent` during the MVP.

Initial event vocabulary:
- `search.performed`
- `search.zero_results`
- `search.result_clicked`
- `marketplace.viewed`
- `marketplace.result_clicked`

Events record behavior but never change publication, capability, pricing, stock or ownership state.

## Evolution path

The architecture deliberately preserves later upgrades:

`Canonical PostgreSQL data`
`↓`
`Search projection/index`
`↓`
`Lexical + semantic retrieval`
`↓`
`Re-ranking/personalization`

A dedicated search engine, PostgreSQL full-text/trigram indexes, vector retrieval or AI query understanding may be introduced when scale/evidence justifies it.

Phase 28 Intelligence may later add learned ranking, intent understanding and semantic recommendations, but those systems must consume canonical records rather than become an alternate marketplace truth.

## Consequences

Benefits:
- fastest path to a real Search gate
- no duplicate marketplace data
- eligibility rules remain consistent
- ranking can be inspected and tuned
- future search infrastructure can be added behind the same product contract
- avoids premature AI/search-service complexity

Trade-offs:
- initial fuzzy/semantic understanding is limited
- PostgreSQL lexical queries may need indexes as dataset size grows
- textual nearby matching is less precise than future geospatial search

These trade-offs are acceptable for the controlled MVP because the purpose of Phase 9 is to validate whether Hustle can translate real user intent into useful discovery.