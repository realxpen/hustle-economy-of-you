# ADR-0006 — Content Ownership and Economic Attachments

Status: Accepted
Date: 2026-09-09

## Context

Hustle's core product philosophy treats content as demonstrated capability and a bridge to discovery, trust and economic opportunity. By Phase 7, the system already has one User identity, additive CLIENT/HUSTLER capabilities, a ProfessionalProfile, Services and Products.

The content layer must connect these existing entities without creating a separate creator identity or copying marketplace offers into social-content records.

## Decision

Phase 7 professional content is owned by the creator's existing ProfessionalProfile.

Canonical relationship:

`User → ProfessionalProfile → Post`

The Phase 7 MVP creation gate is exercised by ACTIVE HUSTLER identities. The User remains CLIENT ACTIVE and no creator mode, seller mode, alternate account or role switcher is introduced.

## Post media

Post media is modeled as ordered child records of Post.

The foundation must support:
- VIDEO
- IMAGE

A carousel is one Post with multiple ordered IMAGE media records, not multiple Posts.

Media metadata should support later feed requirements such as dimensions and video duration without putting ranking behavior into Phase 7.

## Economic attachments

A Post can optionally reference canonical marketplace offers:
- Service
- Product

Attachments are relationships, not snapshots of offer data.

A Post attachment must reference an offer owned by the same ProfessionalProfile as the Post creator.

Public Post rendering may expose the attached offer only while that Service/Product is currently PUBLISHED and its professional identity is eligible for public resolution.

Pausing or otherwise making an offer unavailable must not delete or rewrite the Post. The historical Post remains, while the economic attachment renders as unavailable/omitted according to current public eligibility.

The data model should support multiple attachments rather than forcing a single Service-or-Product field that would require destructive redesign later.

## Publication state

Posts use an explicit lifecycle:
- DRAFT
- PUBLISHED
- ARCHIVED

DRAFT is not publicly discoverable.
PUBLISHED is eligible for direct public resolution and later Phase 8 discovery.
ARCHIVED is retained but removed from normal public discovery.

## Interactions

Likes, saves and comments are authoritative relationship/event records, not only mutable counters on Post.

This supports correctness, user-level state and later analytics/trust/ranking without making vanity metrics the content model.

Follow remains a User identity/social-graph relationship rather than a Post ownership field.

Share may initially be represented through application/analytics events until a later product decision requires persisted repost/share entities.

## Discovery boundary

Phase 7 creates and exposes canonical content.

Phase 8 owns feed assembly, ranking, For You/Nearby/Connections and impression/watch instrumentation. Phase 7 must not embed an early ranking algorithm inside content persistence.

## Consequences

This decision preserves Hustle's single-account architecture, lets content demonstrate the same identity that owns Services/Products, keeps economic offers canonical, prevents stale duplicated pricing/stock data inside Posts, and gives later discovery/search/messaging/commerce phases stable entities to reference.
