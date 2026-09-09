# Content Creation Engine

## Purpose

Phase 7 establishes the content layer that connects demonstrated capability to discovery and economic opportunity.

Hustle is not building a vanity-first social feed. Content is useful when it helps a person demonstrate skill, knowledge, process, personality, expertise or results and makes that capability easier to discover and trust.

Core loop:

`Capability → Demonstration → Content → Discovery → Trust → Opportunity`

The MVP build plan defines Phase 7 as one of Hustle's most important phases because content is the bridge between capability, discovery and something economically useful.

## Phase 7 creation scope

The MVP content formats are:
- short video
- single image
- image carousel

A Post also supports:
- caption
- skill / category
- location
- hashtags / tags
- publication state
- created / updated timestamps

Long-form files, PDFs, stories, livestreaming, music and richer composition remain later expansion surfaces unless a later approved decision explicitly brings them forward.

## Creator scope

For the Phase 7 MVP, professional content creation is exercised through the ACTIVE HUSTLER path established by the approved business plan and current MVP gate.

The same User remains CLIENT ACTIVE. Publishing professional content does not create a creator account, seller account, content mode or role switcher.

Canonical ownership:

`User → ProfessionalProfile → Post`

The Post creator is therefore the same Hustle identity that owns the demonstrated capability, Services and Products.

## Economic attachments

A Post may optionally reference economic offers owned by the same professional identity:
- Service
- Product

This is a core Hustle differentiator, not a decorative metadata feature.

Example:

`Video demonstration → Attached Service/Product → Visitor can inspect the offer → Later phases enable message/book/buy`

Attachment rules for the MVP:
- a Post may have no economic attachment
- a Post may attach owned Services and/or Products
- an attached Service must belong to the creator's ProfessionalProfile
- an attached Product must belong to the creator's ProfessionalProfile
- public rendering should only expose an attached offer when that offer is currently PUBLISHED
- pausing/unpublishing an offer must not delete the Post; the attachment becomes unavailable/inactive in public rendering
- attachment records must reference canonical Service/Product IDs rather than duplicate offer data into the Post

The content model should support multiple references so later Hustle surfaces do not need a destructive schema change to attach more than one relevant offer.

## Media ownership

Post media is separate from Service/Product media.

A Post should own ordered media records rather than storing a single opaque media field.

Each media item should capture enough metadata for reliable rendering and later feed behavior, including:
- media type
- storage key / URL
- order
- optional width / height
- optional duration for video
- created timestamp

The initial implementation should use the existing object-storage boundary and private/server-controlled write rules rather than exposing privileged storage credentials to the client.

## Publication lifecycle

MVP Post lifecycle:
- DRAFT
- PUBLISHED
- ARCHIVED

DRAFT is owner-only.
PUBLISHED may resolve publicly.
ARCHIVED is no longer part of normal public discovery but is retained for history rather than silently destroyed.

Deletion can remain an explicit owner operation where appropriate, but publication state should not be confused with physical deletion.

## Content interactions

The Phase 7 source identifies these content interactions:
- like
- comment
- save
- share
- follow

They are part of the Content Creation Engine experience, but they should be implemented as separate interaction records around the canonical Post rather than counters that can become the source of truth.

Minimum architectural direction:
- PostLike: unique User + Post
- PostSave: unique User + Post
- PostComment: User-owned comment on Post, with timestamps and future reply support
- follow belongs to identity/social graph rather than Post ownership
- share can begin as an analytics/action event unless a later decision requires persisted repost/share entities

Public counters may be derived/cached, but interaction records remain authoritative.

## Trust and anti-vanity boundary

Hustle explicitly should not become a vanity-driven social network or content farm.

Therefore Phase 7 should avoid treating likes/follower counts as the primary meaning of content.

The content model must preserve signals that matter for later discovery and trust, such as:
- creator identity
- skill/category
- location
- attached offers
- recency
- interaction events
- later watch/view behavior
- later verified transaction outcomes

Phase 8 owns feed ranking. Phase 7 should create clean data for ranking without prematurely implementing the ranking engine.

## Public Post experience

A public Post should be able to expose:
- creator identity
- creator professional headline / primary skill context
- media
- caption
- skill/category
- location
- tags
- current engagement state/counts
- currently available attached Services/Products
- link to `/u/[username]`

Private contact information must not be exposed.

## Phase boundaries

Phase 7 owns:
- Post creation/editing
- Post media
- Post publication/archive
- economic offer attachments
- core interaction persistence
- direct public Post resolution

Phase 8 owns:
- Home discovery feed
- For You / Nearby / Connections
- feed ranking and impression/watch instrumentation

Phase 9 owns:
- universal Search across Posts/People/Services/Products

Phase 10 owns:
- messaging from Post context

Phase 11/12/13 own:
- booking, orders, payments and escrow

Stories and Live remain their later dedicated phases.

## Phase 7 gate

A real ACTIVE HUSTLER must be able to:

`create Post → add short video/image/carousel + caption/category/location/tags → attach an owned published Service or Product → publish → open the Post as a visitor → see demonstrated capability and the same professional/economic identity`

A second authenticated user should also be able to exercise the implemented interaction primitives without changing ownership or capability state.

CLIENT remains ACTIVE. No role switcher.
