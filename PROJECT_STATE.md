# Hustle Project State

Updated: 2026-09-09

## Current AED capability
Build

## Current MVP phase
Phase 9 — Search + Marketplace

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; every user begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Content demonstrates capability and connects discovery to economic opportunity.
- Services and Products attach to content through canonical relationships.
- Trust and verified outcomes outrank vanity metrics.
- Search/discovery ranking begins simple and explainable; do not prematurely overbuild AI recommendations or semantic search.

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

Hosted example:
- Product `Hustle Creator T-Shirt`
- PUBLISHED / PHYSICAL
- owner `xpen`

### Phase 7 — Content Creation Engine
COMPLETE.

Validated creator loop:
`HUSTLER ACTIVE → create Post → add image/video/carousel + caption/category/location/tags → attach owned Service/Product → publish → open public Post as visitor → same creator/professional/economic identity`

Validated interaction loop:
`second synchronized CLIENT → open Post → like → save → comment → follow/share → refresh → state persists → reverse interactions work`

Hosted examples:
- `xpen` has PUBLISHED Posts with media/category/location/tags
- Post `cmtu0zq9d0009dczt8a1wv3zk` carries canonical Service + Product attachments
- `adminxpen` remained CLIENT ACTIVE while consuming/interacting

### Phase 8 — Home Discovery Feed
COMPLETE.

Validated API/runtime:
- `GET /api/v1/feed/for-you` returned eligible ranked `xpen` Posts to `adminxpen`
- `GET /api/v1/feed/nearby?location=Lagos, Nigeria` returned location-relevant Lagos content
- Connections correctly returned empty after unfollow and populated during the UI follow test
- feed responses contained creator/professional context, engagement/viewer state and current Service/Product attachments
- deterministic ranking reasons were visible and inspectable

Validated Home experience:
- `/home` works with For You / Nearby / Connections
- media-first cards render image/carousel/native-video/YouTube content
- like/save/follow/share controls work in-feed and persist
- following a creator makes eligible content discoverable in Connections
- profile/Post/Service/Product navigation works from discovery
- cursor/progressive-fetch behavior is implemented for larger result sets

Hosted discovery observation verified on 2026-09-09:
- `feed.impression`: persisted
- `feed.view`: persisted
- `feed.watch`: persisted with real dwell durations including 6500ms, 14113ms and 30991ms examples
- `feed.profile_clicked`: persisted
- `feed.service_clicked`: persisted
- current hosted sample contains multiple discovery sessions from CLIENT viewer `adminxpen` targeting creator `xpen`
- discovery events did not mutate ownership or capabilities

One transient For You HTTP 500 was seen before immediate successful repeated calls and did not reproduce during the Home UI gate. Continue observing it during later activation rather than treating it as a current deterministic blocker.

Phase 8 gate passed:

`CLIENT → open Home → discover relevant Hustler/content → understand skill/location → interact → open identity/offer → produce measurable discovery evidence`

## Canonical ownership built so far

`User`
`↓`
`ProfessionalProfile`
`├── Service`
`├── Product → ProductVariant`
`└── Post → PostMedia`

Post economic references:
- `PostServiceAttachment → Service`
- `PostProductAttachment → Product`

Interactions:
- PostLike
- PostSave
- PostComment
- UserFollow
- share + discovery analytics through SystemEvent

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

Phase 8 used the existing SystemEvent analytics foundation and required no new DDL.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Auth/database/storage: hosted Hustle Supabase
- Local Prisma connection: Supabase Session Pooler on port 5432

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally.

Before pulling remote work:
1. run `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` may be regenerated by Next.js and should not be treated as intentional product work unless deliberately changed.

## Current Phase 9 objective
Support intentional discovery.

Feed answers:
> Show me useful people and things.

Search answers:
> I need a photographer in Lagos.

Canonical Phase 9 knowledge:
- `Knowledge/Product/SEARCH_AND_MARKETPLACE.md`
- `Knowledge/Decisions/ADR-0008-search-and-marketplace-query-architecture.md`

## Phase 9 product surfaces

### Search tabs — MVP
- Top
- People
- Posts
- Services
- Products

Later, only when owning phases exist:
- Live
- Stories
- Training
- Requests
- Map

### Marketplace — current MVP
- All
- Services
- Products

Marketplace is browse-first. Search is intent-first. Both resolve the same canonical public records.

## Phase 9 filters

Source-defined concepts:
- category
- skill
- location
- nearby
- price
- rating
- verified
- availability

Only authoritative filters may become functional now.

Current Phase 9 can support:
- category
- skill
- textual location / nearby
- Service/Product min/max price
- verified identity
- Service delivery mode
- Product type

Boundaries:
- authoritative ratings/reviews wait for Phase 14; do not fabricate rating filters
- real-time booking availability waits for Phase 11; current availabilityNote is descriptive, not a real-time calendar

## Phase 9 architecture

Search/Marketplace are server-side read models over canonical PostgreSQL records.

Initial engine:

`query/browse intent`
`↓`
`normalization + filters`
`↓`
`canonical Postgres records`
`↓`
`public eligibility`
`↓`
`deterministic lexical/structured scoring`
`↓`
`type result / Top merge`
`↓`
`cursor pagination`

No duplicate Search source-of-truth entity.
No external search engine, embedding store or opaque AI ranking is required for the Phase 9 gate.

Future search infrastructure may be added behind this contract when evidence/scale justifies it.

## Phase 9 planned slices

### Phase 9A — Search API foundation
Build:
- common search query/filter parsing
- public eligibility helpers
- deterministic relevance scoring
- People search
- Posts search
- Services search
- Products search
- Top result merge
- cursor pagination

Planned API:
- `GET /api/v1/search`
- `GET /api/v1/search/top`
- `GET /api/v1/search/people`
- `GET /api/v1/search/posts`
- `GET /api/v1/search/services`
- `GET /api/v1/search/products`

### Phase 9B — Marketplace browse API
Build:
- All
- Services
- Products
- category/location/price/type filters
- browse ranking
- cursor pagination

Planned API:
- `GET /api/v1/marketplace`
- `GET /api/v1/marketplace/services`
- `GET /api/v1/marketplace/products`

### Phase 9C — Search + Marketplace web experience
Build:
- `/search`
- `/marketplace`
- query input
- Top / People / Posts / Services / Products tabs
- supported filter UI
- result cards with identity/evidence/offer context
- empty/zero-result states
- pagination/progressive loading
- links to canonical public pages

### Phase 9D — Search observation
Track through SystemEvent:
- `search.performed`
- `search.zero_results`
- `search.result_clicked`
- `marketplace.viewed`
- `marketplace.result_clicked`

Do not let analytics mutate Search results or domain ownership.

### Phase 9E — Real search gate
Use real current data to validate examples such as:

`full stack developer Lagos`
`→ xpen / Full-Stack Posts / Full-Stack Web Application Development`

and:

`creator t-shirt`
`→ Hustle Creator T-Shirt`

Validate:
1. Top returns useful mixed results
2. each result tab returns only its type
3. supported filters narrow results correctly
4. unpublished/ineligible records never leak
5. result navigation reaches canonical profile/Post/Service/Product pages
6. zero-results are explicit
7. search events persist
8. CLIENT capability remains unchanged

## Phase 9 boundaries
Phase 10 owns Messaging.
Phase 11 owns Bookings and authoritative service schedule availability.
Phase 12 owns Cart + Orders.
Phase 13 owns Payments + Escrow.
Phase 14 owns Reviews/Ratings/Trust.
Later phases own Stories, Live, Training, Requests and Map surfaces.
Phase 28 Intelligence may later add semantic retrieval, learned ranking and AI query understanding.

## Phase 9 gate

A synchronized user can:

`express a real need → receive relevant eligible People/Posts/Services/Products → filter/browse → open the right identity or offer → produce measurable search evidence`

## Next phase after Phase 9 gate
Phase 10 — Messaging.