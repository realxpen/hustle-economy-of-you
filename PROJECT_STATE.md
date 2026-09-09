# Hustle Project State

Updated: 2026-09-09

## Current AED capability
Build

## Current MVP phase
Phase 7 — Content Creation Engine

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; every user begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Content is demonstrated capability and a bridge to economic opportunity, not entertainment/vanity alone.
- Services and Products can attach to content.
- Trust and verified outcomes outrank vanity metrics.

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
`HUSTLER ACTIVE → create Product draft → add details/media/inventory/variants → save → publish → open /products/[productId] in incognito → same professional identity`

Hosted verification:
- Product `Hustle Creator T-Shirt`
- PUBLISHED / PHYSICAL
- inventory tracking enabled; quantity 20
- 4 variants persisted
- owner `xpen`
- CLIENT ACTIVE
- HUSTLER ACTIVE

Canonical offer ownership:
`User → ProfessionalProfile → Service/Product`

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

Hosted content foundation now includes:
- `Post`
- `PostMedia`
- `PostServiceAttachment`
- `PostProductAttachment`
- `PostStatus`: DRAFT / PUBLISHED / ARCHIVED
- `PostMediaType`: IMAGE / VIDEO
- RLS enabled on all Phase 7 content tables
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

## Current Phase 7 objective
Build the Content Creation Engine:

`Capability → Demonstration → Content → Discovery → economic opportunity`

Canonical content ownership:
`User → ProfessionalProfile → Post → PostMedia`

Economic references:
`Post → Service`
`Post → Product`

Attachments reference canonical offers; price, stock and service data are never duplicated into Post as source of truth.

Canonical knowledge:
- `Knowledge/Product/CONTENT_CREATION.md`
- `Knowledge/Decisions/ADR-0006-content-ownership-and-economic-attachments.md`

## Phase 7 implementation status

### Phase 7A — Content data foundation
IMPLEMENTED; LOCAL BUILD GATE PENDING.

Implemented:
- Post model
- ordered PostMedia child records
- IMAGE / VIDEO media types
- DRAFT / PUBLISHED / ARCHIVED lifecycle
- caption / category / location / tags
- Service attachment relation
- Product attachment relation
- same-ProfessionalProfile ownership structure
- hosted Supabase migration `phase7_content_foundation`
- RLS + `hustle_api` policies
- database checks for media source, position, dimensions and duration metadata

Media composition foundation:
- one short-video media item OR one-to-ten images
- carousel = one Post with multiple ordered IMAGE records
- Post media is independent of Service/Product media

### Phase 7B — Content API
IMPLEMENTED; LOCAL BUILD GATE PENDING.

Owner API:
- `GET /api/v1/posts/mine`
- `POST /api/v1/posts`
- `GET /api/v1/posts/mine/:postId`
- `PUT /api/v1/posts/:postId`
- `POST /api/v1/posts/:postId/media`
- `DELETE /api/v1/posts/:postId/media/:mediaId`
- `POST /api/v1/posts/:postId/services/:serviceId`
- `DELETE /api/v1/posts/:postId/services/:serviceId`
- `POST /api/v1/posts/:postId/products/:productId`
- `DELETE /api/v1/posts/:postId/products/:productId`
- `POST /api/v1/posts/:postId/publish`
- `POST /api/v1/posts/:postId/archive`

Public API:
- `GET /api/v1/posts/:postId`

Rules implemented:
- owner authentication required
- ACTIVE HUSTLER required for professional Post creation/mutation
- Post belongs to existing ProfessionalProfile
- attached Service/Product must belong to that same ProfessionalProfile
- attachment may remain historically linked while public rendering only includes currently PUBLISHED offers
- publication requires PUBLISHED ProfessionalProfile, caption, category and valid media
- public Post resolution requires Post PUBLISHED + ProfessionalProfile PUBLISHED + HUSTLER ACTIVE
- public creator payload excludes private contact data
- archive retains content rather than deleting it
- create/publish/archive emit SystemEvent
- Phase 8 ranking/feed logic is not embedded into Post persistence

### Phase 7C — Content creator experience
PENDING.

Next:
- create/manage Post web experience
- video/image/carousel composition
- caption/category/location/tags
- owned Service/Product attachment picker
- draft/save/publish/archive controls
- public `/posts/[postId]` experience

### Phase 7D — Core interactions
PENDING.

Planned:
- like/unlike
- save/unsave
- comments
- follow identity foundation
- share action/event foundation
- authoritative interaction records; counters derived rather than ownership truth

## Phase 7 boundaries
Phase 8 owns For You / Nearby / Connections feed, ranking, impressions and watch instrumentation.
Phase 9 owns universal search.
Phase 10 owns messaging.
Phase 11/12/13 own booking/orders/payments.
Stories and Live remain their later dedicated phases.

## Phase 7 gate
A real ACTIVE HUSTLER must be able to:

`create Post → add short video/image/carousel + caption/category/location/tags → attach owned published Service/Product → publish → open Post as visitor → see demonstrated capability and same professional/economic identity`

A second user should be able to exercise implemented interaction primitives without altering Post ownership/capability state.

CLIENT remains ACTIVE. No role switcher.

## Next phase after Phase 7 gate
Phase 8 — Home Discovery Feed.
