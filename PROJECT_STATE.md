# Hustle Project State

Updated: 2026-09-10

## Current AED capability
Build

## Current MVP phase
**Phase 11 — Booking System**

## Binding product rules
- Product name: Hustle.
- Slogan: `Hustle — The Economy of You.`
- Mobile-first and Nigeria-first.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity. Every user begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent account modes.
- Content demonstrates capability and connects discovery to economic opportunity.
- Services and Products attach to content through canonical relationships.
- Trust and verified outcomes outrank vanity metrics.
- Search/discovery ranking begins simple and explainable; do not prematurely overbuild AI recommendation/search systems.
- Financial state must never be faked. Phase 13 owns authoritative payment, escrow, ledger, refund, payout and reconciliation.

## Completed MVP phases

### Phase 1 — Technical Foundation
COMPLETE.

### Phase 2 — Authentication + Unified Account
COMPLETE.

Validated:
`Register → verify → synchronize → CLIENT → profile → sign out → sign in → retain same identity`

### Phase 3 — Hustler Application + Verification
COMPLETE.

Validated:
`CLIENT → apply → private proof → review → APPROVED → same User retains CLIENT ACTIVE + receives HUSTLER ACTIVE`

### Phase 4 — Professional Profile
COMPLETE.

Validated public professional identity at `/u/[username]`.

### Phase 5 — Services
COMPLETE.

Validated published Service owned by the same professional identity.

Hosted example:
- `Full-Stack Web Application Development`
- Service ID: `cmttw02cy0001dc02zzd5j89x`
- owner: `xpen`

### Phase 6 — Products
COMPLETE.

Hosted example:
- `Hustle Creator T-Shirt`
- Product ID: `cmtty8gfs0001dcavtny1iiuh`
- PUBLISHED / PHYSICAL
- owner: `xpen`

### Phase 7 — Content Creation Engine
COMPLETE.

Validated:
- Post creation/publication
- image/video/carousel media
- Service/Product attachments
- like/save/comment/share/follow interactions
- second CLIENT can interact without gaining HUSTLER capability

Hosted example:
- Post `cmtu0zq9d0009dczt8a1wv3zk` carries canonical Service + Product attachments.

### Phase 8 — Home Discovery Feed
COMPLETE.

Validated:
- For You
- Nearby
- Connections
- deterministic ranking
- cold-start discovery
- cursor pagination
- creator/offer context
- feed interactions
- discovery instrumentation

Hosted events include:
- `feed.impression`
- `feed.view`
- `feed.watch`
- `feed.profile_clicked`
- `feed.service_clicked`

### Phase 9 — Search + Marketplace
COMPLETE.

Validated:
- Search Top / People / Posts / Services / Products
- deterministic lexical relevance
- filters
- zero-results
- Marketplace All / Services / Products
- canonical result navigation
- Search/Marketplace observation events

Hosted events include:
- `search.performed`
- `search.zero_results`
- `search.result_clicked`
- `marketplace.viewed`
- `marketplace.result_clicked`

### Phase 10 — Messaging
**COMPLETE.**

Canonical knowledge:
- `Knowledge/Product/MESSAGING.md`
- `Knowledge/Decisions/ADR-0009-messaging-conversation-ownership.md`

Durable model:
- `Conversation`
- `ConversationParticipant → User`
- `Message → User (sender)`
- deterministic DIRECT pair reuse through `directKey`
- participant `lastReadAt`
- canonical message context references

Validated real conversation:
- Conversation: `cmtvfjhdv0004dc5ojcc8jmdb`
- participants: `adminxpen` and `xpen`
- same pair reuses the same DIRECT conversation
- two-way text messaging works
- unread/read state persists
- Profile/Post/Service/Product messaging entry points work
- canonical Service context persisted and reopened correctly
- `/messages` inbox + `/messages/[conversationId]` thread work
- image and file attachments work and persist
- second participant can open private attachments
- typing indicator works and expires ephemerally

Private attachment foundation:
- bucket: `message-attachments`
- private: yes
- size limit: 25 MB
- participant-scoped SELECT/INSERT policies
- uploader-scoped DELETE policy
- path shape: `{conversationId}/{authSubject}/{unique-file}` inside the bucket
- Message metadata stores the canonical bucket-qualified reference

Hosted Phase 10D evidence verified on 2026-09-10:
- PNG image attachment persisted in Message and Storage
- PDF attachment persisted in Message and Storage
- attachment MIME type and byte size match stored objects
- real messages exist from both `adminxpen` and `xpen`
- `messaging.conversation_started` persisted
- `messaging.message_sent` persisted
- `adminxpen` remains `CLIENT:ACTIVE`
- `xpen` remains `CLIENT:ACTIVE + HUSTLER:ACTIVE`

Typing state is intentionally ephemeral and is not written to PostgreSQL.

Phase 10 gate passed:
`CLIENT → discover Hustler → open/reuse direct conversation → send/receive text + context + private media/files → read/unread state persists → typing remains ephemeral → identity capabilities unchanged`

## Canonical ownership built so far

`User`
`↓`
`ProfessionalProfile`
`├── Service`
`├── Product → ProductVariant`
`└── Post → PostMedia`

Post references:
- `PostServiceAttachment → Service`
- `PostProductAttachment → Product`

Interactions:
- `PostLike`
- `PostSave`
- `PostComment`
- `UserFollow`

Messaging:
- `Conversation`
- `ConversationParticipant → User`
- `Message → User`

Analytics/observation:
- `SystemEvent`

## Supabase
Dedicated project:
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
- `phase10_messaging_attachments`

Phase 8 and Phase 9 required no new DDL; they reuse canonical records + `SystemEvent`.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Auth/database/storage: hosted Hustle Supabase
- Local Prisma connection: Supabase Session Pooler 5432
- Node: 22.x via `.nvmrc`

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally.

Before pulling remote work:
1. `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` may be regenerated by Next.js and should not be treated as intentional product work unless deliberately changed.

# Phase 11 — Booking System

## Objective
Turn a published Service into an explicit, schedulable transaction request with an unambiguous lifecycle.

Canonical Phase 11 knowledge:
- `Knowledge/Product/BOOKING_SYSTEM.md`
- `Knowledge/Decisions/ADR-0010-booking-lifecycle-and-payment-boundary.md`

Source flow:

`Service → Book → Choose date/time → Provide requirements → Submit request → Hustler accepts → Payment → Work begins → Completion`

Canonical statuses:
- `REQUESTED`
- `ACCEPTED`
- `DECLINED`
- `PAYMENT_PENDING`
- `FUNDED`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
- `DISPUTED`
- `REFUNDED`
- `CLOSED`

## Phase 11 ownership

Planned relationship:

`Service → Booking`

`Booking → client User`

`Booking → hustler User`

`Booking → optional Conversation`

Booking uses the same unified User identity. No Client/Hustler booking account modes or role switcher.

## Payment boundary
Phase 11 owns Booking lifecycle/scheduling, but Phase 13 owns real payment + escrow.

For a paid Service:
- Hustler acceptance may advance the Booking to `PAYMENT_PENDING`.
- Phase 11 MUST NOT fake `FUNDED`.
- Only authoritative Phase 13 payment/escrow integration may advance paid Bookings into `FUNDED`.

The full source-defined paid transaction gate through completion is therefore an integrated Phase 11 + Phase 13 gate. Phase 11 itself must prove the booking workflow through the explicit payment boundary without inventing financial success.

## Phase 11 implementation slices

### Phase 11A — Booking data foundation
PENDING.

Build:
- Booking model + source-defined status enum
- Client / Hustler / Service ownership
- optional Conversation link
- transaction-critical historical terms snapshot
- requested/confirmed schedule
- requirements
- lifecycle timestamps
- indexes, integrity constraints, RLS and API-role policies

### Phase 11B — Booking API + transition engine
PENDING.

Build:
- create request
- client booking list
- Hustler booking list
- booking detail
- accept / decline
- cancel
- valid start/complete transitions
- payment-boundary contract
- transition audit events
- participant authorization

### Phase 11C — Booking web experience
PENDING.

Build:
- Service → Book
- request form
- `/bookings`
- `/bookings/[bookingId]`
- unified Client/Hustler action context without role switching
- explicit current status + next required action
- direct Message link

### Phase 11D — Scheduling + conflict validation
PENDING.

Build:
- simple active-booking overlap checks
- confirmed schedule behavior
- invalid/duplicate transition handling
- clear failure states

### Phase 11E — Real booking gate
PENDING.

Use `adminxpen` CLIENT and `xpen` HUSTLER with Service `cmttw02cy0001dc02zzd5j89x`.

Validate:
1. CLIENT requests Service with date/time + requirements.
2. Service owner receives it.
3. unauthorized users cannot read/mutate it.
4. Hustler accepts/declines according to lifecycle state.
5. paid booking reaches `PAYMENT_PENDING` without fake funding.
6. booking history/status persists across session refresh.
7. Booking can connect to the existing direct conversation.
8. invalid/duplicate transitions are rejected.
9. scheduling conflicts are explicit.
10. capabilities remain unchanged.

## Next build target
**Phase 11A + 11B — Booking data foundation and Booking API/transition engine.**

## Next phase after Booking capability
Phase 12 — Cart + Orders.
