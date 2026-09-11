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
- item-level historical title/variant/SKU/options/type/price/quantity snapshots
- delivery recipient/contact/address fields on Order
- tracked inventory source snapshot (`NONE`, `PRODUCT`, `VARIANT`)
- cart version for checkout race protection
- amount/quantity/self-order/inventory integrity checks
- indexes + foreign keys
- RLS on all four commerce tables
- API-role policies only

Hosted migration:
- Supabase version `20260910144537`
- `phase12_cart_order_foundation`

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

Validated real gate:
- `adminxpen` added `Hustle Creator T-Shirt` variant `Large/Black`
- Cart quantity updated from 2 to 3
- checkout preview returned seller `xpen`, physical delivery requirement and subtotal ₦45,000
- checkout created Order `cmtwre2ur000wdcclebkqiynp`
- Order persisted as `PENDING`, not `PAID`
- buyer/seller ownership persisted correctly
- OrderItem snapshot preserved Product, variant, SKU, price, quantity and inventory source
- Cart cleared after successful checkout
- buyer history/detail returned the Order
- seller history/detail returned the same Order
- quantity 6 was rejected against current variant stock 5
- quantity 1 remained addable after the PENDING Order, proving PENDING did not reserve/deduct stock
- Cart clear persisted
- hosted events include `cart.item_added`, `cart.item_updated`, `checkout.previewed`, `order.created` and `cart.checked_out`
- hosted Order still has `paymentReference = null` and `paidAt = null`

Rules:
- synchronized User required
- self-purchase rejected
- only PUBLISHED Product + PUBLISHED ProfessionalProfile + ACTIVE HUSTLER seller is purchasable
- active ProductVariant is required when the Product has active variants
- price is server-derived from variant override or canonical Product
- seller and currency are server-derived
- quantity is bounded to 1–99
- stock is validated on add/update/preview/checkout
- checkout revalidates current publication, seller capability, variant, price and inventory state
- multi-seller or mixed-currency carts are partitioned into separate seller/currency Orders
- physical Orders require delivery name, phone, address and city
- checkout uses serializable transaction + Cart version claim to reduce duplicate/racing checkout
- successful checkout clears Cart items only after PENDING Order(s) are created
- Order history/detail is relationship-authorized for buyer or seller
- cursor pagination is stable by `createdAt + id`

Phase 13 integration boundary:
- `CommerceService.markPaidFromAuthoritativePayment(...)`
- not exposed by any controller
- idempotent payment-reference behavior
- PENDING-only transition to PAID
- tracked inventory is revalidated and decremented inside the same serializable transaction
- insufficient stock prevents payment-state advancement

### Phase 12C — Cart + Orders web experience
IMPLEMENTED; CI PASSED; UI RUNTIME GATE PENDING.

Built:
- Product detail → variant + quantity → Add to Cart
- `/cart`
- quantity update/remove/clear
- current stock and seller context
- `/checkout`
- server checkout preview
- physical delivery form only when required
- explicit `PENDING` / Phase 13 payment boundary
- seller-group summaries for multi-seller checkout
- `/orders`
- unified Purchases + Product sales relationship views with no role switching
- `/orders/[orderId]`
- immutable item snapshot display
- buyer/seller counterpart context
- transaction timeline
- private physical delivery details for participants
- message buyer/seller using existing Messaging
- Product/Cart/Orders navigation links
- Account links to Cart + Orders

Latest Phase 12C GitHub CI:
- locked install passed
- web/admin/mobile typechecks passed
- Prisma generation passed
- API typecheck passed
- web/admin/API builds passed

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

Before Phase 13 exists, prove UI flow:
`Product → Add to Cart → Cart → Checkout → PENDING Order → buyer history → seller visibility`
with no fake payment.

After Phase 13 exists, extend the integrated gate through authoritative `PAID`, inventory deduction, fulfillment, completion, and refund behavior.

## Next gate
**Validate Phase 12C in the browser, then build Phase 12D fulfillment state engine.**
