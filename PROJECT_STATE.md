# Hustle Project State

Updated: 2026-09-11

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

## Phase 11 payment boundary retained
Real Client/Hustler booking flow is validated through `PAYMENT_PENDING`. `FUNDED`, paid work start, and financial completion remain authoritative Phase 13 integration responsibilities.

Canonical Phase 11 knowledge:
- `Knowledge/Product/BOOKING_SYSTEM.md`
- `Knowledge/Decisions/ADR-0010-booking-lifecycle-and-payment-boundary.md`

## Canonical ownership built so far

`User`
`├── Cart → CartItem → Product / ProductVariant`
`├── Order (buyer)`
`├── Order (seller)`
`├── ConversationParticipant`
`└── Booking relationships`

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

Commerce:
- one Cart per User
- CartItem references canonical Product + optional ProductVariant
- seller-scoped Order records
- OrderItem preserves transaction-critical Product/variant/price/quantity snapshots
- private delivery fields remain transaction data
- Cart and PENDING Order do not reserve stock
- authoritative payment integration deducts tracked inventory atomically
- server-authoritative fulfillment state engine
- buyer confirms DELIVERED → COMPLETED

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
- `phase12_cart_order_foundation` — hosted version `20260910144537`

Phase 12C and Phase 12D require no new database migration.

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

`Product → Add to Cart → Checkout → Payment → Order → Processing → Delivery → Completed`

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

## Phase 12 payment + inventory boundary
- Checkout creates durable seller-scoped `PENDING` Orders.
- There is no browser/client route that can mark an Order `PAID`.
- `CommerceService.markPaidFromAuthoritativePayment(...)` is the server-only Phase 13 boundary.
- Authoritative payment confirmation revalidates and deducts tracked inventory atomically.
- Cart and `PENDING` Orders do not reserve stock.
- `REFUNDED` remains authoritative Phase 13 financial state.

## Phase 12 implementation status

### Phase 12A — Cart + Order data foundation
IMPLEMENTED; HOSTED MIGRATION APPLIED; RUNTIME VALIDATED.

Hosted migration:
- Supabase version `20260910144537`
- `phase12_cart_order_foundation`

Built:
- `OrderStatus`
- `OrderInventorySource`
- `Cart`
- `CartItem`
- `Order`
- `OrderItem`
- one Cart per User
- buyer/seller User relationships
- canonical Product/ProductVariant relationships
- historical item snapshots
- delivery fields
- tracked inventory source snapshot
- cart version race protection
- indexes, constraints, RLS and API-role policies

### Phase 12B — Cart + checkout API
IMPLEMENTED; CI PASSED; RUNTIME VALIDATED.

API:
- `GET /api/v1/cart`
- `POST /api/v1/cart/items`
- `PUT /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart/items/:itemId`
- `DELETE /api/v1/cart`
- `POST /api/v1/cart/checkout/preview`
- `POST /api/v1/cart/checkout`
- `GET /api/v1/orders/buyer`
- `GET /api/v1/orders/seller`
- `GET /api/v1/orders/:orderId`

Validated real API gate:
- `adminxpen` added `Hustle Creator T-Shirt` / `Large/Black`
- quantity updated to 3
- preview resolved seller `xpen` and ₦45,000 subtotal
- checkout created Order `cmtwre2ur000wdcclebkqiynp`
- Order remained `PENDING` with `paymentReference = null` and `paidAt = null`
- immutable Product/variant/SKU/price/quantity snapshot persisted
- Cart cleared after checkout
- buyer and seller both retrieved the same Order
- quantity 6 rejected against stock 5
- quantity 1 remained addable after checkout, proving PENDING does not reserve inventory
- hosted commerce events persisted

### Phase 12C — Cart + Orders web experience
IMPLEMENTED; CI PASSED; UI RUNTIME VALIDATED.

Validated browser flow:
`Product → choose variant/quantity → Add to Cart → /cart → quantity update → /checkout → delivery → PENDING Order → /orders → Order detail`

Also validated:
- buyer purchase view
- seller Product-sales view on the same unified account model
- same Order visible to both participants
- Messaging entry for buyer/seller
- no browser payment/PAID action
- no role switching

Built:
- Product Cart controls
- `/cart`
- `/checkout`
- `/orders`
- `/orders/[orderId]`
- private delivery data only inside participant-authorized Order detail
- Cart + Orders account navigation

### Phase 12D — Fulfillment state engine
IMPLEMENTED; CI/LOCAL RUNTIME GATE PENDING.

API:
- `POST /api/v1/orders/:orderId/process`
- `POST /api/v1/orders/:orderId/ship`
- `POST /api/v1/orders/:orderId/deliver`
- `POST /api/v1/orders/:orderId/complete`
- `POST /api/v1/orders/:orderId/cancel`

Server rules:
- seller must own the Order and retain ACTIVE HUSTLER capability for fulfillment actions
- `PAID → PROCESSING` seller only
- physical Order: `PROCESSING → SHIPPED → DELIVERED` seller only
- digital-only Order: `PROCESSING → DELIVERED` seller only
- an Order with any PHYSICAL item follows the physical path
- `DELIVERED → COMPLETED` buyer only
- `PENDING → CANCELLED` buyer or seller
- cancellation after authoritative payment is rejected; refund handling belongs to Phase 13
- `REFUNDED` remains inaccessible from Phase 12 public endpoints
- compare-and-set status updates reject duplicate, stale, skipped and out-of-order transitions
- transition events contain IDs/status/relationship only, not private delivery data

Web Order detail now exposes only currently valid viewer actions:
- unpaid PENDING cancellation
- seller Start processing
- seller Mark shipped for physical Orders
- seller Mark delivered
- buyer Confirm completion

Observation added:
- `order.processing`
- `order.shipped`
- `order.delivered`
- `order.completed`
- `order.cancelled`

No new DDL required.

### Phase 12E — Real commerce gate
PENDING.

Before Phase 13 exists, validate:
- PENDING cancellation works for a participant
- repeated cancellation is rejected
- PENDING Order cannot process/ship/deliver/complete
- seller-only and buyer-only authorization boundaries hold
- no public path can manufacture PAID or REFUNDED state

After Phase 13 exists, extend the integrated gate through authoritative `PAID`, atomic inventory deduction, fulfillment, buyer completion and refund behavior.

## Next gate
**Validate Phase 12D pre-payment transition/cancellation boundaries locally. Full paid fulfillment remains a Phase 12 + Phase 13 integration gate.**
