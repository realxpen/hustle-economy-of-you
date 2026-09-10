# Hustle Project State

Updated: 2026-09-10

## Current AED capability
Build

## Current MVP phase
Phase 11 — Booking System

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Content demonstrates capability and connects discovery to economic opportunity.
- Services and Products attach to content through canonical relationships.
- Trust and verified outcomes outrank vanity metrics.
- Search/discovery ranking begins simple and explainable.
- Transaction state must be explicit; never fake payment, funding, escrow, refunds, or completion.

## Completed MVP phases
- Phase 1 — Technical Foundation: COMPLETE
- Phase 2 — Authentication + Unified Account: COMPLETE
- Phase 3 — Hustler Application: COMPLETE
- Phase 4 — Professional Profile: COMPLETE
- Phase 5 — Services: COMPLETE
- Phase 6 — Products: COMPLETE
- Phase 7 — Content Creation Engine: COMPLETE
- Phase 8 — Home Discovery Feed: COMPLETE
- Phase 9 — Search + Marketplace: COMPLETE
- Phase 10 — Messaging: COMPLETE

Validated identity/capability loop remains:
`CLIENT → optional HUSTLER application → same User gains HUSTLER → no role switching`

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
- private `message-attachments` storage
- canonical Post/Service/Product message context
- ephemeral typing presence

Booking:
- `Booking → Service`
- `Booking → client User`
- `Booking → hustler User`
- `Booking → optional Conversation`
- narrow historical transaction terms snapshot

Analytics/observation:
- `SystemEvent`

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
- `phase10_messaging_attachments`
- `phase11_booking_foundation`

Phase 8, Phase 9 and Phase 11D require no new DDL; they reuse canonical records and application-level validation.

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

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` may be regenerated and should not be treated as intentional product work unless deliberately changed.

# Phase 11 — Booking System

## Objective
Turn a published Service into an explicit, schedulable transaction request with a server-authoritative lifecycle.

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

## Payment boundary
Phase 11 owns Booking lifecycle/scheduling. Phase 13 owns payment, escrow, ledger, refunds, payout, reconciliation and authoritative financial callbacks.

Paid Service path:
`REQUESTED → PAYMENT_PENDING → [Phase 13 authoritative funding] → FUNDED → IN_PROGRESS → COMPLETED`

Rules:
- accepting a paid Booking records `acceptedAt` and moves to `PAYMENT_PENDING`
- Phase 11 exposes no browser/client route that can set `FUNDED`
- `FUNDED` is reserved for `BookingService.markFundedFromAuthoritativePayment(...)`
- paid Bookings cannot start while `PAYMENT_PENDING`
- zero-price Bookings may use `ACCEPTED → IN_PROGRESS`

## Phase 11 implementation status

### Phase 11A — Booking data foundation
IMPLEMENTED; RUNTIME VALIDATED.

Built:
- Booking model + source-defined status enum
- Client/Hustler/Service ownership
- optional direct Conversation link
- requested + confirmed schedule
- requirements, location, notes
- historical Service title/price/currency/pricing snapshot
- lifecycle timestamps
- cancellation actor/reason
- indexes + integrity checks
- RLS + `hustle_api` policy
- Service deletion restricted once Booking transaction history exists

Hosted migration:
- Supabase version `20260910123630`
- `phase11_booking_foundation`

### Phase 11B — Booking API + transition engine
IMPLEMENTED; RUNTIME VALIDATED.

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

Runtime evidence:
- Client `adminxpen` requested Service `cmttw02cy0001dc02zzd5j89x`
- Booking `cmtvjyxxm000ddccstu8da92l` persisted
- Hustler `xpen` accepted it
- paid Booking reached `PAYMENT_PENDING`
- `acceptedAt` + `paymentPendingAt` persisted
- `fundedAt`, `startedAt`, `completedAt` remain null
- start before funding returned Conflict
- duplicate/invalid state transition protection worked
- direct Conversation remained linked

Hosted events:
- `booking.requested`
- `booking.accepted`
- `booking.payment_pending`

### Phase 11C — Booking web experience
IMPLEMENTED; UI RUNTIME VALIDATED.

Built and validated:
- Service → `Book this service`
- `/bookings/new/[serviceId]`
- `/bookings`
- `/bookings/[bookingId]`
- Client and Hustler relationship sections on one account with no role switching
- explicit status + next action
- transaction terms + requested/confirmed schedule
- accept/decline/cancel/start/complete action surfaces when allowed
- Phase 13 payment-boundary explanation with no fake Fund action
- direct Message link and canonical Service link
- refresh/session persistence

Hosted UI-created Booking evidence exists for the same Client/Hustler/Service/Conversation relationship.

### Phase 11D — Scheduling + conflict validation
IMPLEMENTED; LOCAL RUNTIME GATE PENDING.

Built:
- `BookingScheduleService`
- blocking statuses: `ACCEPTED`, `PAYMENT_PENDING`, `FUNDED`, `IN_PROGRESS`
- REQUESTED bookings do not reserve a Hustler schedule before acceptance
- booking creation checks requested time against already confirmed active work
- accept re-checks availability to protect against schedule changes between request and decision
- Hustler may confirm or adjust start/end from the Booking detail before acceptance
- exact duplicate pending request for the same Client + Service + requested schedule is rejected
- `GET /api/v1/bookings/availability` returns availability without exposing another Booking's private details
- bounded interval overlap uses half-open schedule semantics
- optional no-end schedules behave as point-time reservations for MVP conflict checks
- request form performs an availability preflight and the API re-validates on create
- conflict errors surface explicitly in both request and accept UI
- no new database migration required

GitHub CI after Phase 11D implementation:
- locked install passed
- web/admin/mobile typechecks passed
- Prisma generation passed
- API typecheck passed
- web/admin/API builds passed

### Phase 11E — Final Booking gate
PENDING.

Validate Phase 11D with two requests for the same Hustler:
1. keep an existing confirmed `PAYMENT_PENDING` booking as the blocking schedule
2. attempt a new overlapping request and receive explicit unavailable/conflict behavior
3. submit a non-overlapping request successfully
4. as Hustler, adjust that request's confirmed time to overlap the blocking booking and verify acceptance is rejected
5. choose a non-overlapping confirmed time and accept successfully
6. resubmit the exact same pending request and verify duplicate-request rejection
7. confirm paid Booking still stops at `PAYMENT_PENDING`
8. confirm capabilities remain unchanged

Integrated paid completion through `FUNDED → IN_PROGRESS → COMPLETED` remains the Phase 11 + Phase 13 transaction gate.

## Next build target after Phase 11D validation
Close Phase 11 and open Phase 12 — Cart + Orders.
