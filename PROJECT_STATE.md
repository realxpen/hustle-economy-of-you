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
- Feed ranking begins simple and explainable; do not prematurely overbuild AI recommendations.

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
- validated Post: `cmtu0zq9d0009dczt8a1wv3zk`
- Post has canonical Service + Product attachments
- second user `adminxpen` remains `CLIENT:ACTIVE`
- persisted like/save/comment/share evidence confirmed
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

Phase 8 does not currently require a new database migration. Discovery events persist through the existing `SystemEvent` analytics foundation while ranking reads canonical Post, interaction, UserFollow and professional identity records.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Auth/database/storage: hosted Hustle Supabase
- Local Prisma connection: Supabase Session Pooler on port 5432

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally. Never commit secrets/private environment values.

Before pulling new remote work, the project owner must run `git status`. Intentional local changes should be committed/pushed first; generated or accidental files should not be blindly committed.

## Current Phase 8 objective
Solve Hustle's central discovery problem:

> Great people are not being discovered.

Home feed tabs:
- For You
- Nearby
- Connections

Each feed item exposes:
- creator identity
- professional skill/headline context
- Post media/content
- location
- engagement
- viewer interaction state
- currently eligible attached Service/Product
- profile CTA context

Canonical Phase 8 knowledge:
- `Knowledge/Product/DISCOVERY_FEED.md`
- `Knowledge/Decisions/ADR-0007-discovery-feed-ranking-and-instrumentation.md`

## Phase 8 implementation status

### Phase 8A — Feed API + deterministic ranking
IMPLEMENTED; RUNTIME GATE PASSED.

API:
- `GET /api/v1/feed` defaults to For You
- `GET /api/v1/feed/for-you`
- `GET /api/v1/feed/nearby`
- `GET /api/v1/feed/connections`
- query parameters: `cursor`, `limit`, optional `location`

Eligibility:
- Post PUBLISHED
- ProfessionalProfile PUBLISHED
- creator HUSTLER ACTIVE
- viewer's own Posts excluded
- attached Service/Product included only while PUBLISHED

Deterministic ranking signals:
- category affinity from authoritative like/save/comment history
- normalized textual location match
- recency buckets
- capped engagement
- verified identity
- professional experience
- follow connection
- published economic context

Pagination:
- deterministic score ordering
- publication timestamp + Post ID tie-breaker
- opaque cursor
- bounded page/candidate sizes for the current MVP

Runtime validation on 2026-09-09 with `adminxpen`:
- For You returned eligible `xpen` Posts with ranking reasons, engagement state, creator context and current Service/Product attachments
- Nearby with `Lagos, Nigeria` returned the same eligible Lagos content with location weighting
- Connections correctly returned an empty feed with `No followed creators yet` after the earlier unfollow validation
- one transient For You HTTP 500 was observed before immediate successful repeated requests; continue observing during the Home UI gate rather than treating it as a reproduced deterministic failure

### Phase 8B — Discovery instrumentation
IMPLEMENTED; RUNTIME/HOSTED EVENT GATE PASSED.

Endpoint:
- `POST /api/v1/feed/events`

Accepted events:
- `feed.impression`
- `feed.view`
- `feed.watch`
- `feed.profile_clicked`
- `feed.service_clicked`
- `feed.product_clicked`

Rules:
- synchronized authenticated Hustle User required
- Post must remain discovery-eligible
- Service/Product click target must be a current PUBLISHED attachment
- payload records viewer, Post, creator target, tab/position/session where supplied
- `feed.watch` requires `watchMs`
- non-watch session events use simple recent duplicate protection
- events never mutate content/offer/capability state

Hosted validation on 2026-09-09:
- `feed.impression` persisted for Post `cmtu0zq9d0009dczt8a1wv3zk`
- `feed.watch` persisted with `watchMs: 6500`
- both events correctly identify the CLIENT viewer and target creator through SystemEvent payload

### Phase 8C — Home feed experience
IMPLEMENTED; LOCAL UI GATE PENDING.

Web route:
- `/home`

Implemented experience:
- For You / Nearby / Connections tabs
- authenticated feed loading
- media-first cards
- image carousel rail
- native video rendering plus YouTube embed handling
- creator/professional context
- current Service/Product cards
- like/save/follow/share controls reusing Phase 7 APIs
- comments/open-Post CTA
- cursor load-more
- cold-start explanation
- empty Connections guidance
- account CTA into discovery feed

Instrumentation wired into UI:
- impression when a card is rendered
- view when at least 55% of a card becomes visible
- watch/dwell duration while substantially visible
- profile clicks
- Service clicks
- Product clicks
- Phase 7 share event remains authoritative for share actions

### Phase 8D — Real discovery gate
PENDING.

Validate through `/home`:
1. `adminxpen` can open For You and discover `xpen`
2. Nearby surfaces Lagos content
3. follow `xpen` from For You, then Connections surfaces `xpen` Posts
4. like/save/follow/share controls work in-feed
5. Post/profile/Service/Product navigation works
6. load-more behaves correctly when a cursor exists
7. discovery events persist in SystemEvent
8. ownership/capabilities remain unchanged

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
