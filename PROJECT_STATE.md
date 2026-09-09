# Hustle Project State

Updated: 2026-09-09

## Current AED capability
Build

## Current MVP phase
Phase 8 — Home Discovery Feed

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; every user begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Content demonstrates capability and connects discovery to economic opportunity.
- Services and Products attach to content through canonical relationships.
- Trust and verified outcomes outrank vanity metrics.
- Feed ranking must begin simple and explainable; do not prematurely overbuild AI recommendations.

## Completed MVP phases

### Phase 1 — Technical Foundation
COMPLETE.

### Phase 2 — Authentication + Unified Account
COMPLETE.

Validated:
`Register → verify → synchronize → CLIENT → complete profile → sign out → sign back in → retain same Hustle identity`

### Phase 3 — Hustler Application
COMPLETE.

Validated:
`CLIENT → application → private proof → submit → reviewer verification → APPROVED → same User retains CLIENT ACTIVE + receives HUSTLER ACTIVE`

### Phase 4 — Professional Profile
COMPLETE.

Validated:
`HUSTLER ACTIVE → bootstrap professional profile → edit/save → publish → open /u/[username] as visitor`

### Phase 5 — Services
COMPLETE.

Validated:
`HUSTLER ACTIVE → create Service → edit/save → publish → open /services/[serviceId] in incognito → same professional identity`

### Phase 6 — Products
COMPLETE.

Validated:
`HUSTLER ACTIVE → create Product → details/media/inventory/variants → publish → open public Product in incognito → same professional identity`

Hosted verification:
- Product `Hustle Creator T-Shirt`
- PUBLISHED / PHYSICAL
- inventory tracking enabled; quantity 20
- 4 variants persisted
- owner `xpen`
- CLIENT ACTIVE
- HUSTLER ACTIVE

### Phase 7 — Content Creation Engine
COMPLETE.

Validated creator loop:
`HUSTLER ACTIVE → create Post → add image/video/carousel + caption/category/location/tags → attach owned Service/Product → publish → open public Post as visitor → same creator/professional/economic identity`

Validated interaction loop:
`second synchronized CLIENT → open Post → like → save → comment → follow/share → refresh → state persists → unlike/unsave/unfollow/comment-delete controls work`

Hosted verification on 2026-09-09:
- `xpen` has real PUBLISHED Posts with persisted media/category/location/tags
- latest validated Post: `cmtu0zq9d0009dczt8a1wv3zk`
- Post has canonical Service + Product attachments
- second user `adminxpen` remains `CLIENT:ACTIVE`
- persisted interaction evidence on the validated Post includes 1 like, 1 save and 1 comment from `adminxpen`
- `post.shared` SystemEvent persisted
- UserFollow reversal left no stale follow relationship after unfollow validation
- Post ownership/capability state remained unchanged

Canonical content ownership:
`User → ProfessionalProfile → Post → PostMedia`

Canonical interactions:
- `PostLike`
- `PostSave`
- `PostComment`
- `UserFollow`
- share via `post.shared` SystemEvent

## Supabase
Dedicated Hustle project:
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`
- API URL: `https://pfgarmyygybmhiiuopym.supabase.co`

Applied hosted migrations:
- `phase1_foundation`
- `phase2_unified_account`
- `api_database_role`
- `phase3_hustler_application_foundation`
- `phase3_hustler_proof_storage`
- `phase4_professional_profile_foundation`
- `phase5_service_foundation`
- `phase6_product_foundation`
- `phase7_content_foundation`
- `phase7_content_interactions`

Current hosted domain foundation includes:
- User / UserCapability
- ProfessionalProfile
- Service
- Product / ProductVariant
- Post / PostMedia
- PostServiceAttachment / PostProductAttachment
- PostLike / PostSave / PostComment / UserFollow
- SystemEvent analytics foundation
- RLS remains enabled on protected domain tables
- `hustle_api` remains the API-side database actor

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Auth/database/storage: hosted Hustle Supabase
- Local Prisma connection: Supabase Session Pooler on port 5432

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally. Never commit secrets/private environment values.

## Current Phase 8 objective
Solve Hustle's central discovery problem:

> Great people are not being discovered.

Home feed tabs:
- For You
- Nearby
- Connections

Each feed item must expose:
- creator identity
- professional skill/headline context
- Post media/content
- location
- engagement
- currently eligible attached Service/Product
- profile CTA

Canonical Phase 8 knowledge:
- `Knowledge/Product/DISCOVERY_FEED.md`
- `Knowledge/Decisions/ADR-0007-discovery-feed-ranking-and-instrumentation.md`

## Phase 8 ranking direction
Start simple and explainable.

Initial signals:
- interest/history where available
- skill/category relevance
- location relevance
- recency
- engagement
- trust
- connections

No opaque ML/AI recommender is required for the MVP. A cold-start user with zero connections/history must still receive useful eligible content.

## Phase 8 instrumentation
Track discovery behavior at minimum:
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

Message/booking/purchase conversions connect when their owning phases exist; do not fake them in Phase 8.

## Phase 8 planned slices

### Phase 8A — Feed API + deterministic ranking
- eligible published Post query
- `For You` feed
- `Nearby` feed
- `Connections` feed
- stable cursor pagination
- cold-start fallback
- safe creator + current offer context

### Phase 8B — Discovery instrumentation
- `feed.impression`
- `feed.view`
- `feed.watch`
- `feed.profile_clicked`
- `feed.service_clicked`
- `feed.product_clicked`
- continue using authoritative Phase 7 interaction records for like/save/comment/follow/share behavior

### Phase 8C — Home feed experience
- Home route/feed shell
- For You / Nearby / Connections tabs
- media-first feed cards
- creator/profile context
- attached Service/Product CTAs
- interaction controls reusing Phase 7 APIs
- pagination / load-more or progressive fetching
- view/watch instrumentation

### Phase 8D — Real discovery gate
Validate with real users/data:
1. a synchronized user with zero follows can open For You and discover relevant Hustlers
2. location-relevant content appears in Nearby when matching data exists
3. followed creator content appears in Connections
4. profile/Service/Product navigation works from feed items
5. discovery events persist without mutating ownership/capabilities

## Phase 8 boundaries
Phase 9 owns intentional universal Search + Marketplace discovery.
Phase 10 owns Messaging.
Phase 11 owns Bookings.
Phase 12 owns Cart + Orders.
Phase 13 owns Payments + Escrow.
Phase 28 Intelligence may later augment feed ranking after enough real evidence exists.

## Phase 8 gate
A synchronized new user with zero connections must be able to:

`open Home → receive eligible relevant Posts → understand creator/skill/content/location → open profile or attached offer → produce measurable discovery events`

CLIENT remains ACTIVE. No role switcher.

## Next phase after Phase 8 gate
Phase 9 — Search + Universal Discovery.
