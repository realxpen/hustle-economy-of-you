# Hustle Project State

Updated: 2026-09-10

## Current AED capability
Build

## Current MVP phase
Phase 11 — Booking System

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
- Transaction state must be explicit; never fake payment, funding, escrow, or completion state.

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
`HUSTLER ACTIVE → professional profile → edit/save → publish → public identity`

### Phase 5 — Services
COMPLETE.

Validated:
`HUSTLER ACTIVE → create Service → edit/save → publish → public Service → same professional identity`

### Phase 6 — Products
COMPLETE.

Validated:
`HUSTLER ACTIVE → create Product → details/media/inventory/variants → publish → public Product`

### Phase 7 — Content Creation Engine
COMPLETE.

Validated:
`HUSTLER ACTIVE → create Post → media + caption/category/location/tags → attach Service/Product → publish → public Post`

Interactions validated with a second CLIENT identity: like, save, comment, follow, share and reversal all persisted correctly.

### Phase 8 — Home Discovery Feed
COMPLETE.

Validated:
- For You / Nearby / Connections
- cold-start discovery
- deterministic ranking
- media-first Home feed
- profile/Service/Product navigation
- discovery observation through `SystemEvent`

### Phase 9 — Search + Marketplace
COMPLETE.

Validated:
- Search: Top / People / Posts / Services / Products
- Marketplace: All / Services / Products
- deterministic lexical relevance
- filters, cursor pagination and explicit zero-results
- canonical result navigation
- search/marketplace observation events

### Phase 10 — Messaging
COMPLETE.

Validated:
- one reusable direct conversation per User pair
- participant authorization
- text messages
- read/unread state
- Post/Service/Product context
- private image/file attachments
- participant-private signed reads
- ephemeral typing indicator
- two-way messaging between `adminxpen` and `xpen`
- capabilities remained unchanged

## Canonical ownership built so far

`User`
`↓`
`ProfessionalProfile`
`├── Service → Booking`
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

Booking:
- `Booking → Service`
- `Booking → client User`
- `Booking → hustler User`
- `Booking → optional Conversation`
- narrow historical transaction terms snapshot

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
- `phase11_booking_foundation`

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
1. run `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` may be regenerated by Next.js and should not be treated as intentional product work unless deliberately changed.

# Phase 11 — Booking System

## Objective
Turn a published Service into an explicit, schedulable transaction request with an unambiguous lifecycle.

Canonical knowledge:
- `Knowledge/Product/BOOKING_SYSTEM.md`
- `Knowledge/Decisions/ADR-0010-booking-lifecycle-and-payment-boundary.md`

Canonical flow:
`Service → Book → Choose date/time → requirements → request → Hustler decision → payment boundary → work → completion`

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

## Phase 11 payment boundary
Phase 11 owns Booking lifecycle/scheduling. Phase 13 owns payment, escrow, ledger, refunds, payout, reconciliation and authoritative financial callbacks.

For a paid Service:
- Hustler acceptance advances the Booking to `PAYMENT_PENDING` while recording `acceptedAt`.
- Phase 11 does not expose a client/frontend route that can set `FUNDED`.
- `FUNDED` is available only through the exported server-side `markFundedFromAuthoritativePayment` integration boundary for the future Phase 13 payment module.
- paid Bookings cannot start while `PAYMENT_PENDING`.

For a zero-price Service:
- acceptance remains `ACCEPTED`
- the Hustler may start directly from `ACCEPTED`

## Phase 11 implementation status

### Phase 11A — Booking data foundation
IMPLEMENTED; LOCAL RUNTIME GATE PENDING.

Built:
- `BookingStatus` enum with the source-defined lifecycle
- `Booking` model
- Client / Hustler / Service ownership
- optional direct Conversation link
- requested + confirmed start/end timestamps
- requirements, location and notes
- transaction-critical snapshot:
  - Service title
  - agreed price minor units
  - currency
  - Service pricing type
- lifecycle timestamps for accept/decline/payment/funding/start/complete/cancel/dispute/refund/close
- cancellation actor + reason
- deterministic indexes
- database integrity checks
- RLS enabled
- `hustle_api` API-role policy
- Service deletion becomes restricted once transaction history exists

Hosted migration:
- Supabase version `20260910123630`
- name `phase11_booking_foundation`

Hosted schema verification:
- `Booking` table exists
- RLS is enabled
- `hustle_api_all_bookings` policy is active

### Phase 11B — Booking API + transition engine
IMPLEMENTED; LOCAL RUNTIME GATE PENDING.

API:
- `POST /api/v1/bookings`
- `GET /api/v1/bookings/client`
- `GET /api/v1/bookings/hustler`
- `GET /api/v1/bookings/:bookingId`
- `POST /api/v1/bookings/:bookingId/accept`
- `POST /api/v1/bookings/:bookingId/decline`
- `POST /api/v1/bookings/:bookingId/cancel`
- `POST /api/v1/bookings/:bookingId/start`
- `POST /api/v1/bookings/:bookingId/complete`

Creation rules:
- synchronized User required
- currently PUBLISHED Service required
- Service ProfessionalProfile must be PUBLISHED
- Service owner must have ACTIVE HUSTLER capability
- self-booking rejected
- requested start must be in the future
- Service must currently have a concrete price basis
- optional Conversation must be the existing DIRECT conversation for exactly the Client and Hustler
- Client/Hustler/price/currency/pricing type are server-derived rather than trusted from request body

Transition rules:
- only ACTIVE booked Hustler may accept/decline
- `REQUESTED → DECLINED` via decline
- paid accept: `REQUESTED → PAYMENT_PENDING` + accepted/payment timestamps
- zero-price accept: `REQUESTED → ACCEPTED`
- Client may cancel `REQUESTED`, `ACCEPTED`, or `PAYMENT_PENDING`
- Hustler may cancel only after acceptance/payment-pending; REQUESTED should use decline
- paid start requires `FUNDED`
- zero-price start requires `ACCEPTED`
- start moves to `IN_PROGRESS`
- complete requires `IN_PROGRESS` and moves to `COMPLETED`
- optimistic status condition rejects stale/duplicate transitions
- no public/controller endpoint can fake `FUNDED`

Payment integration boundary:
- `BookingService.markFundedFromAuthoritativePayment(...)`
- exported from `BookingModule`
- not exposed by `BookingController`
- accepts only `PAYMENT_PENDING` paid Bookings
- emits `booking.funded` after authoritative future Phase 13 integration

Booking events:
- `booking.requested`
- `booking.accepted`
- `booking.declined`
- `booking.cancelled`
- `booking.payment_pending`
- `booking.funded` — server integration boundary only
- `booking.started`
- `booking.completed`

Event payloads exclude private requirements/job brief text.

Pagination:
- Client and Hustler lists use deterministic opaque cursor pagination.

CI:
- locked install passed
- web/admin/mobile typechecks passed
- Prisma generation passed
- API typecheck passed
- web/admin/API builds passed

### Phase 11C — Booking web experience
PENDING.

Build:
- Service → Book CTA
- request form
- `/bookings`
- `/bookings/[bookingId]`
- unified Client/Hustler action context without role switching
- explicit status + next required action
- direct Message link

### Phase 11D — Scheduling + conflict validation
PENDING.

Build:
- active-booking overlap checks
- confirmed schedule behavior
- duplicate/invalid schedule failure states

### Phase 11E — Real booking gate
PENDING.

Use real identities:
`adminxpen CLIENT → Service cmttw02cy0001dc02zzd5j89x → request → xpen HUSTLER → accept → PAYMENT_PENDING`

Validate:
1. Client can create a request with future schedule + requirements.
2. Service owner receives it in Hustler list.
3. unrelated User cannot read or mutate it.
4. Hustler can accept or decline only from valid state.
5. paid booking reaches `PAYMENT_PENDING` without fake funding.
6. start is blocked before authoritative funding.
7. Client/Hustler cancellation rules are explicit.
8. optional Conversation linkage accepts only the correct direct pair.
9. status/history and narrow terms snapshot persist.
10. capabilities remain unchanged.

Integrated paid completion through `FUNDED → IN_PROGRESS → COMPLETED` remains the Phase 11 + Phase 13 transaction gate.

## Next build target after 11A/11B runtime validation
**Phase 11C — Booking web experience.**

## Next phase after Booking capability
Phase 12 — Cart + Orders.
