# Hustle Project State

Updated: 2026-09-10

## Current AED capability
Build

## Current MVP phase
Phase 10 — Messaging

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

Hosted discovery observation verified:
- `feed.impression`
- `feed.view`
- `feed.watch`
- `feed.profile_clicked`
- `feed.service_clicked`

Phase 8 gate passed:
`CLIENT → open Home → discover relevant Hustler/content → understand skill/location → interact → open identity/offer → produce measurable discovery evidence`

### Phase 9 — Search + Marketplace
COMPLETE.

Validated API/runtime:
- Top search returned useful mixed People/Post/Service/Product results for `full stack developer Lagos`
- People search returned `xpen` with exact/prefix/phrase ranking reasons
- Service search respected normal-Naira min/max price filters
- Product search returned `Hustle Creator T-Shirt`
- explicit zero-results worked for unrelated intent
- Marketplace All returned current Product + Service records
- Marketplace Service filters respected category + delivery mode
- Marketplace Product filters respected category + Product type + max price
- public eligibility remained tied to PUBLISHED profile/offer/content + HUSTLER ACTIVE

Validated Search + Marketplace web experience:
- `/search` works with Top / People / Posts / Services / Products
- `/marketplace` works with All / Services / Products
- supported filter UI works
- result cards navigate to canonical Profile/Post/Service/Product pages
- zero-result state is explicit
- pagination contract is wired

Hosted observation verified on 2026-09-10:
- `search.performed`: persisted
- `search.zero_results`: persisted
- `search.result_clicked`: persisted after navigation-race fix
- `marketplace.viewed`: persisted
- `marketplace.result_clicked`: persisted

Observed real search click:
- query: `full stack developer Lagos`
- tab: `top`
- result type: `post`
- target: `/posts/cmtu09f9b0001dcztnjrjdg95`

Phase 9 gate passed:
`CLIENT → express need → receive relevant eligible results → filter/browse → open canonical identity/offer/content → produce measurable search evidence`

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
- share + discovery/search analytics through SystemEvent

Messaging foundation:
- `Conversation`
- `ConversationParticipant → User`
- `Message → User (sender)`
- direct-pair reuse through deterministic `directKey`
- participant read marker through `lastReadAt`
- canonical Message context references to Post / Service / Product

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
- `phase10_messaging_foundation`

Phase 8 and Phase 9 used the existing SystemEvent analytics foundation and required no new DDL.
Phase 10A introduced durable Conversation / ConversationParticipant / Message tables with RLS and API-role policies.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Auth/database/storage: hosted Hustle Supabase
- Local Prisma connection: Supabase Session Pooler on port 5432
- Node: 22.x (`.nvmrc`)

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally.

Before pulling remote work:
1. run `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` may be regenerated by Next.js and should not be treated as intentional product work unless deliberately changed.

## Current Phase 10 objective
Allow discovery to turn into conversation.

Canonical Phase 10 knowledge:
- `Knowledge/Product/MESSAGING.md`
- `Knowledge/Decisions/ADR-0009-messaging-conversation-ownership.md`

## Phase 10 entry points
- Profile → Message
- Service → Message
- Product → Message
- Post → Message Creator

## Phase 10 MVP
- one-to-one direct conversations
- text messages
- image messages
- file messages
- timestamps
- participant read state
- typing state
- basic notification-ready events
- canonical context references to current Post / Service / Product

Future context types are introduced only when their owning domains exist:
- Booking — Phase 11
- Order — Phase 12

## Phase 10 identity rule
Messaging uses the same User identity.

Do not create:
- Client inbox identity
- Hustler inbox identity
- seller messaging account
- role-switching inbox

Any synchronized User may participate in a conversation. Capabilities remain unchanged by messaging.

## Phase 10 architecture

Durable model:

`Conversation`
`├── ConversationParticipant → User`
`└── Message → User (sender)`

MVP direct conversations contain exactly two distinct Users.
Repeated attempts to message the same User resolve the existing direct thread rather than create duplicates.

Read state:
- participant-level `lastReadAt`

Message context:
- reference canonical Post / Service / Product
- never duplicate mutable offer/content state inside chat

Attachments:
- private object storage references
- PostgreSQL stores metadata/reference only

Typing:
- ephemeral realtime/presence state
- no durable row per keystroke
- chat history remains functional if typing presence degrades

Messaging stays inside the NestJS modular monolith for the MVP.

## Phase 10 boundaries
Phase 11 owns Bookings.
Phase 12 owns Cart + Orders.
Phase 13 owns Payments + Escrow and any authoritative financial invoice state.
Phase 14 owns Reviews/ratings/reporting/blocking policy.
Phase 16 owns Story replies.
Phase 17 owns Live chat.
Phase 18 owns Agent delegation.
Phase 20 owns the full Notifications product.

## Phase 10 implementation status

### Phase 10A — Messaging data foundation
IMPLEMENTED; LOCAL RUNTIME GATE PENDING.

Built:
- `Conversation`
- `ConversationParticipant`
- `Message`
- deterministic nullable `directKey` with uniqueness for DIRECT thread reuse
- non-null `lastActivityAt` for inbox ordering and cursor pagination
- participant `lastReadAt`
- Message text + attachment metadata + canonical context identity fields
- indexes, integrity checks, RLS, enum grants and `hustle_api` policies
- hosted migration `phase10_messaging_foundation`

Attachment metadata exists now, but private upload/read URL production is intentionally deferred to Phase 10D.

### Phase 10B — Messaging API
IMPLEMENTED; LOCAL RUNTIME GATE PENDING.

API:
- `POST /api/v1/messaging/conversations/direct`
- `GET /api/v1/messaging/conversations`
- `GET /api/v1/messaging/conversations/:conversationId`
- `GET /api/v1/messaging/conversations/:conversationId/messages`
- `POST /api/v1/messaging/conversations/:conversationId/messages`
- `POST /api/v1/messaging/conversations/:conversationId/read`
- `POST /api/v1/messaging/conversations/:conversationId/messages/:messageId/context-opened`

Rules:
- synchronized User required
- self-conversation rejected
- same User pair resolves same DIRECT conversation
- only participants may list/read/send/mark-read within a conversation
- conversation and message pagination use opaque deterministic cursors
- sender read marker advances on send
- read marker can advance through a specific Message or the current latest Message
- unread counts derive from messages newer than participant `lastReadAt` and exclude the participant's own messages
- message requires text, attachment reference or canonical context
- text capped at 4000 characters
- Message context is accepted only for currently eligible public Post / Service / Product records
- Message context stores IDs, not mutable price/content snapshots
- attachment DB references must use the conversation-scoped `message-attachments/{conversationId}/...` path convention
- participant-safe conversation output excludes email/phone/private account fields

Events:
- `messaging.conversation_started`
- `messaging.message_sent`
- `messaging.context_opened`

Event payloads contain IDs/metadata rather than private message text.

GitHub CI passed after Phase 10A/10B: locked install, web/admin/mobile typechecks, Prisma generation, API typecheck and web/admin/API builds all succeeded.

### Phase 10C — Messaging web experience
PENDING.

Build:
- `/messages`
- `/messages/[conversationId]`
- inbox list
- conversation thread
- composer
- read/unread state
- context cards
- entry points from Profile/Post/Service/Product

### Phase 10D — Typing + private attachment path
PENDING.

Build:
- private messaging attachment bucket/path policy
- image/file attachment UX
- ephemeral typing state using realtime/presence adapter
- graceful degraded behavior if realtime typing is unavailable

### Phase 10E — Real messaging gate
PENDING.

Use real identities:

`adminxpen CLIENT → discover xpen → Message → send → xpen replies → attach/open Post/Service/Product context → refresh/reopen → history/read state persists`

Validate:
1. duplicate direct thread is not created
2. non-participant cannot read/send
3. text persists
4. image/file path is participant-private
5. context points to canonical current entity
6. read state persists
7. typing is ephemeral/degradable
8. messaging events are measurable
9. CLIENT/HUSTLER capabilities remain unchanged

## Phase 10 gate

A prospective client can contact a Hustler without leaving Hustle and can preserve the discovery/economic context that caused the conversation.

## Next phase after Phase 10 gate
Phase 11 — Booking System.
