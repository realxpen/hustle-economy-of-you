# ADR-0007 — Discovery Feed Ranking and Instrumentation

Status: Accepted
Date: 2026-09-09

## Context

Phase 7 established canonical published Posts, creator identity, media, interactions and Service/Product attachments. Phase 8 must now assemble those records into a Home discovery experience without prematurely introducing an opaque AI recommender.

The approved MVP source defines three Home feed tabs: For You, Nearby and Connections. It also says early ranking should start simple using interest, skill/category relevance, location, recency, engagement, trust and connections, while tracking discovery behavior such as impressions, views and watch duration.

## Decision

Phase 8 will implement an explainable server-side feed assembler over canonical `Post` records.

The feed does not create a duplicate content entity. It resolves existing eligible Posts and their current creator/offer context.

### Feed tabs

- **For You**: ranked eligible published Posts, including a cold-start fallback for users with zero connections/history.
- **Nearby**: eligible Posts prioritized by current textual location relevance in the MVP.
- **Connections**: eligible Posts authored by identities the viewer follows through `UserFollow`.

### Eligibility

A feed candidate must satisfy:
- Post `PUBLISHED`
- ProfessionalProfile `PUBLISHED`
- creator `HUSTLER ACTIVE`

Attached Services/Products remain canonical references and are only rendered while currently `PUBLISHED`.

### Ranking

The first ranking implementation must be deterministic and inspectable.

It may score available signals such as:
- viewer/category affinity
- location relevance
- recency
- engagement
- current trust indicators
- connection relationship

Weights should be ordinary code/configuration that can be audited and tuned. Machine-learning ranking, embeddings and opaque recommendation models are explicitly deferred until real behavioral data justifies them.

Raw popularity alone must not dominate ranking because Hustle's product philosophy prioritizes useful capability, trust and opportunity over vanity metrics.

### Cold start

For You must work for a synchronized user with zero follows and little/no interaction history.

The cold-start feed should fall back to eligible recent content and available location/category signals rather than returning an empty result.

### Instrumentation

Phase 8 records discovery events separately from canonical Post state.

Initial event vocabulary:
- `feed.impression`
- `feed.view`
- `feed.watch`
- `feed.profile_clicked`
- `feed.service_clicked`
- `feed.product_clicked`

Existing Phase 7 interaction records/events continue to represent likes, comments, saves, shares and follows.

Downstream message/booking/purchase conversions are connected when their owning phases exist; Phase 8 must not simulate them.

### Pagination

Feed endpoints use stable pagination and deterministic tie-breaking. Cursor-based pagination is preferred over loading the full candidate set into the client.

## Consequences

This approach gives Hustle a usable discovery feed now, preserves the single source of truth for content/offers, supports cold-start discovery, creates observation data for later Evolution/Intelligence, and avoids locking the MVP into premature AI-ranking complexity.

The ranking logic is expected to evolve after real pilot observation. Phase 28 Intelligence may later augment or replace the simple scorer with learned recommendations, but only after sufficient evidence exists.