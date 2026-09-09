# Home Discovery Feed

## Purpose

Phase 8 exists to solve Hustle's central discovery problem:

> Great people are not being discovered.

Hustle is a capability-to-opportunity ecosystem, so the Home feed must help users discover useful people, demonstrated capability and economic opportunities they did not already know existed.

Core loop:

`Content → Discovery → Identity → Trust → Opportunity`

The feed is not an entertainment-only surface and must not optimize for empty attention. Product success is measured by meaningful discovery and movement toward profiles, Services, Products and later transactions.

## MVP feed surfaces

The Home feed has three tabs:
- **For You**
- **Nearby**
- **Connections**

### For You

Purpose: allow a user, including a new user with zero connections, to discover relevant published Posts from eligible Hustlers.

Initial ranking signals:
- skill/category relevance
- location relevance
- recency
- engagement
- trust signals available at the current phase
- connection relationship
- user interaction history where available

The MVP must use a deterministic, inspectable scoring approach. Do not introduce opaque AI ranking yet.

### Nearby

Purpose: prioritize useful published content whose creator/Post location is relevant to the viewer's selected or known location.

MVP location matching may begin with normalized textual location/city matching. Precise geospatial distance belongs to later discovery/map work unless explicitly promoted into scope.

Nearby must still preserve recency, quality and eligibility checks rather than returning every location match indiscriminately.

### Connections

Purpose: show published Posts from identities the viewer follows.

`UserFollow` is the authoritative connection relationship.

Connections is not a separate account mode and does not change the viewer's CLIENT/HUSTLER/AGENT capabilities.

## Feed item contract

Every feed item should expose enough context for a user to understand both the demonstrated capability and the next useful action:
- Post ID
- creator identity
- creator username/avatar
- professional headline / primary skill
- Post media
- caption
- category/skill
- location
- tags
- engagement counts
- viewer interaction state when authenticated
- currently eligible attached Services
- currently eligible attached Products
- profile CTA

Feed items reference the existing canonical Post, Service, Product and ProfessionalProfile records. The feed must not copy economic offer data into a new source-of-truth listing model.

## Eligibility

A Post is feed-eligible only when:
- Post is `PUBLISHED`
- ProfessionalProfile is `PUBLISHED`
- creator has `HUSTLER ACTIVE`

Attached Service/Product cards are exposed only while those offers remain `PUBLISHED` and publicly eligible.

Archived/draft Posts do not enter the feed.

## Early ranking

The Phase 8 source explicitly says to start simple and not overbuild AI ranking.

Initial ranking should combine explainable signals such as:

`relevance + location + recency + engagement + trust + connections`

The exact weights are an MVP implementation choice and must remain easy to inspect and tune.

Important boundaries:
- no machine-learning recommender required
- no hidden per-user embedding/vector system required
- no artificial boost based only on raw follower/like popularity
- trust and economic usefulness should remain more important than vanity metrics

## Cold start

The Phase 8 gate requires a new user with zero connections to discover relevant Hustlers.

Therefore For You cannot depend on follow graph history.

Cold-start fallback should use available signals in this order:
1. explicit/known user location when available
2. categories/skills inferred from existing interaction history when available
3. broadly useful recent published content
4. trust/quality signals to break ties

A user with no history must still receive a populated feed if eligible content exists.

## Instrumentation

Phase 8 introduces discovery observation signals. Track at minimum:
- impression
- view
- watch duration
- like
- comment
- save
- share
- profile visit
- Service click
- Product click

The source also names message, booking and purchase as downstream conversion signals. Those should be connected when their owning phases exist rather than faked now.

### Event principles

- instrumentation records behavior; it does not grant authorization
- analytics events must not mutate canonical Post/offer state
- impression/view/watch signals should identify Post and viewer/anonymous context where appropriate
- duplicate events should be minimized with simple client/session rules
- later ranking may consume these signals, but Phase 8 does not require a self-learning recommender

## Pagination

Feed APIs must be pagination-ready from the beginning.

Use stable cursor-style pagination based on a deterministic ordering key rather than loading every eligible Post at once.

The ranking implementation must preserve a stable tie-breaker such as Post creation/publication timestamp + ID.

## Phase boundaries

Phase 8 owns:
- Home feed assembly
- For You / Nearby / Connections
- early explainable ranking
- feed pagination
- impression/view/watch instrumentation
- feed-level profile/Service/Product click instrumentation

Phase 9 owns:
- intentional universal search
- search filters and search result tabs

Phase 10+ own downstream message/booking/order/payment behavior.

Phase 28 Intelligence may later replace or augment simple scoring with learned recommendations after sufficient real data exists.

## Phase 8 gate

A synchronized user with zero connections must be able to:

`open Home → receive eligible published Posts → understand creator/skill/content/location → open profile or attached offer → produce measurable discovery events`

A second user who follows `xpen` must also see the creator's eligible Posts in Connections.

Nearby must produce location-relevant content when matching data exists.

No role switcher. CLIENT remains the default consumer capability.