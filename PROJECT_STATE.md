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
Phase 11 owns Booking lifecycle/scheduling. Phase 13 owns payment, escrow, ledger, refunds, payout, reconciliation, and authoritative financial callbacks.

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
- `BookingStatus` enum
- `Booking` model
- Client / Hustler / Service ownership
- optional direct Conversation link
- requested + confirmed start/end timestamps
- requirements, location, notes
- historical transaction snapshot: Service title, price minor units, currency, pricing type
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

Creation rules:
- synchronized User required
- currently PUBLISHED Service + PUBLISHED ProfessionalProfile + ACTIVE HUSTLER owner required
- self-booking rejected
- requested start must be future
- concrete Service price basis required
- optional Conversation must be the exact DIRECT pair
- Client/Hustler/price/currency/pricing type are server-derived

Transition rules:
- only the booked ACTIVE HUSTLER may accept/decline
- `REQUESTED → DECLINED`
- paid accept: `REQUESTED → PAYMENT_PENDING`
- zero-price accept: `REQUESTED → ACCEPTED`
- Client may cancel `REQUESTED`, `ACCEPTED`, `PAYMENT_PENDING`
- Hustler may cancel only after acceptance/payment-pending; pending request uses decline
- paid start requires `FUNDED`
- zero-price start requires `ACCEPTED`
- start → `IN_PROGRESS`
- complete requires `IN_PROGRESS` → `COMPLETED`
- stale/duplicate transitions are rejected

Payment integration boundary:
- `BookingService.markFundedFromAuthoritativePayment(...)`
- exported from `BookingModule`
- not exposed by `BookingController`

Runtime gate verified on 2026-09-10 with real identities:
- Client `adminxpen` requested published Service `cmttw02cy0001dc02zzd5j89x`
- Booking `cmtvjyxxm000ddccstu8da92l` persisted
- Hustler `xpen` received and accepted it
- paid Booking reached `PAYMENT_PENDING`
- `acceptedAt` and `paymentPendingAt` persisted
- `fundedAt`, `startedAt`, and `completedAt` remain null
- starting before funding correctly returned Conflict
- duplicate/invalid transition protection worked
- existing direct Conversation `cmtvfjhdv0004dc5ojcc8jmdb` remained linked

Hosted Booking events verified:
- `booking.requested`
- `booking.accepted`
- `booking.payment_pending`

No private requirements text is copied into SystemEvent payloads.

### Phase 11C — Booking web experience
IMPLEMENTED; LOCAL UI GATE PENDING.

Built:
- Service page `Book this service` CTA
- `/bookings/new/[serviceId]` request form
- automatic reuse/opening of the direct conversation on booking creation
- `/bookings` unified relationship view with Client bookings + Hustler service requests in one account
- `/bookings/[bookingId]` detail page
- transaction snapshot, schedule, requirements, location and lifecycle display
- explicit status + server-provided next action
- Hustler accept/decline/start/complete controls when state permits
- Client/Hustler cancellation controls under existing server lifecycle rules
- explicit Phase 13 payment-boundary presentation
- direct Message link
- canonical Service link
- Bookings link from Account
- cursor load-more support
- graceful non-Hustler section state without introducing role switching

GitHub CI after Phase 11C:
- locked install passed
- web/admin/mobile typechecks passed
- Prisma generation passed
- API typecheck passed
- web/admin/API builds passed

### Phase 11D — Scheduling + conflict validation
PENDING.

Build:
- active-booking overlap checks for same Hustler
- confirmed schedule conflict behavior
- duplicate/invalid schedule failure states

### Phase 11E — Real Booking UI gate
PENDING.

Use real identities:
`adminxpen CLIENT → published Service → Book → xpen HUSTLER → accept → PAYMENT_PENDING`

Validate:
1. Service CTA opens real request form.
2. Client submits future date/time + requirements.
3. Client sees Booking in `/bookings`.
4. Hustler sees same Booking in `/bookings` without role switching.
5. Hustler accepts and paid Booking reaches `PAYMENT_PENDING`.
6. Payment boundary is explicit and no fake Funded action exists.
7. direct Message link opens/reuses the same conversation.
8. refresh/sign-out/sign-in preserves Booking history/status.
9. invalid action states remain blocked by server.
10. capabilities remain unchanged.

Integrated paid completion through `FUNDED → IN_PROGRESS → COMPLETED` remains the Phase 11 + Phase 13 transaction gate.

## Next build target after Phase 11C UI validation
**Phase 11D — scheduling + conflict validation.**

## Next phase after Booking capability
Phase 12 — Cart + Orders.
