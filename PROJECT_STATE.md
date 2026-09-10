# Hustle Project State

Updated: 2026-09-10

## Current AED capability
Build

## Current MVP phase
Phase 12 — Cart + Orders

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Content demonstrates capability and connects discovery to economic opportunity.
- Services and Products attach to content through canonical relationships.
- Trust and verified outcomes outrank vanity metrics.
- Transaction state must be explicit; never fake payment, funding, escrow, refunds, delivery, or completion.

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
- Phase 11 — Booking System: COMPLETE at the Phase 13 payment boundary

## Phase 11 validated evidence

Real Client/Hustler flow validated with `adminxpen` and `xpen`:
- Service → Book CTA
- request form → Booking persisted
- Client and Hustler relationship views on the same unified account model
- accept/decline/cancel transition rules
- paid booking reaches `PAYMENT_PENDING`
- no public/browser path can fake `FUNDED`
- start before funding is rejected
- direct Conversation linkage persists
- scheduling overlap detection works
- duplicate pending request protection works
- Hustler can adjust confirmed schedule before acceptance
- acceptance revalidates schedule server-side
- overlapping confirmed schedule is rejected
- non-overlapping confirmed schedule succeeds
- capabilities remain unchanged

Hosted Booking examples remain in `PAYMENT_PENDING` with `fundedAt`, `startedAt`, and `completedAt` null, preserving the Phase 13 payment boundary.

Integrated paid service completion through `FUNDED → IN_PROGRESS → COMPLETED` remains a Phase 11 + Phase 13 integration gate, not fake Phase 11 state.

Canonical Phase 11 knowledge:
- `Knowledge/Product/BOOKING_SYSTEM.md`
- `Knowledge/Decisions/ADR-0010-booking-lifecycle-and-payment-boundary.md`

## Canonical ownership built so far

`User`
`↓`
`ProfessionalProfile`
`├── Service → Booking`
`├── Product → ProductVariant`
`└── Post → PostMedia`

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
- server-authoritative scheduling conflict validation

Observation:
- `SystemEvent`

## Supabase
Dedicated Hustle project:
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`

Applied hosted migrations include:
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

Phase 11D required no new DDL.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Node: 22.x via `.nvmrc`
- Auth/database/storage: hosted Hustle Supabase

Secrets and `.env` files remain local and must never be committed.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally.

Before pulling remote work:
1. run `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` may be regenerated and should not be treated as intentional product work unless deliberately changed.

# Phase 12 — Cart + Orders

## Objective
Enable product commerce while preserving explicit transaction state and the Phase 13 payment boundary.

Canonical source flow:

`Product → Add to Cart → Checkout → Payment → Order created → Processing → Delivery → Completed`

Canonical order statuses:
- `PENDING`
- `PAID`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `COMPLETED`
- `CANCELLED`
- `REFUNDED`

Canonical knowledge:
- `Knowledge/Product/CART_AND_ORDERS.md`
- `Knowledge/Decisions/ADR-0011-cart-order-lifecycle-and-payment-boundary.md`

## Phase 12 payment boundary
- Phase 12 may create durable `PENDING` Orders at checkout.
- Phase 12 must not expose a client/frontend transition to `PAID`.
- authoritative `PENDING → PAID` belongs to Phase 13 payment confirmation.
- authoritative `REFUNDED` also belongs to Phase 13.
- Cart does not reserve inventory.
- inventory must be revalidated before checkout and again by the future payment-confirmation integration.

## Phase 12 implementation slices

### Phase 12A — Cart + Order data foundation
PENDING.

Build:
- Cart
- CartItem
- Order
- OrderItem
- OrderStatus
- buyer/seller/Product/variant relationships
- transaction-critical item snapshots
- delivery fields
- indexes + integrity constraints
- RLS + API-role policies

### Phase 12B — Cart + checkout API
PENDING.

Build:
- get cart
- add item
- update quantity
- remove item
- clear cart
- checkout preview
- checkout to PENDING seller-scoped Order(s)
- stock/variant/publication revalidation
- buyer order list/detail
- seller order list/detail
- payment integration boundary
- order/cart events

### Phase 12C — Cart + Orders web experience
PENDING.

Build:
- Product → Add to Cart
- cart page
- checkout page
- order confirmation/detail
- buyer order history
- seller order management
- message buyer/seller
- explicit payment boundary

### Phase 12D — Fulfillment state engine
PENDING.

Build:
- `PAID → PROCESSING`
- physical: `PROCESSING → SHIPPED → DELIVERED → COMPLETED`
- digital: `PROCESSING → DELIVERED → COMPLETED`
- cancellation boundaries
- invalid/duplicate transition protection

### Phase 12E — Real commerce gate
PENDING.

Before Phase 13 exists, prove:
`Product → Cart → Checkout → PENDING Order`
with correct item snapshot, seller ownership, buyer history, seller visibility, stock validation, and no fake payment.

After Phase 13 exists, extend the integrated gate through authoritative `PAID`, inventory deduction, fulfillment, completion, and refund behavior.

## Next build target
**Phase 12A + 12B — Cart/Order data foundation and Cart + checkout API.**
