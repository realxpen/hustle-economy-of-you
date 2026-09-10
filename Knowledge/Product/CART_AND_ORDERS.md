# Cart + Orders

Status: CANONICAL — Phase 12 ACTIVE
Updated: 2026-09-10

## Purpose

Phase 12 turns published Products into explicit commerce transactions.

Source-defined flow:

`Product → Add to Cart → Checkout → Payment → Order created → Processing → Delivery → Completed`

Source-defined order statuses:

- `PENDING`
- `PAID`
- `PROCESSING`
- `SHIPPED`
- `DELIVERED`
- `COMPLETED`
- `CANCELLED`
- `REFUNDED`

The Phase 12 build must include:
- cart
- checkout
- order details
- seller order management
- buyer order history

## Identity and ownership

Hustle keeps one unified User identity.

A buyer is the existing User acting as the purchaser. A seller is the existing User who owns the Product through their ProfessionalProfile and ACTIVE HUSTLER capability.

No buyer account, seller account, shop-mode identity, or role switcher is introduced.

Canonical relationships:

`User → Cart → CartItem → Product / optional ProductVariant`

`User (buyer) → Order`

`User (seller) → Order`

`Order → OrderItem → Product / optional ProductVariant`

## Cart semantics

Cart is mutable purchase intent, not transaction history.

A CartItem references the canonical Product and optional ProductVariant and stores quantity. Current price, publication state, variant activity and stock must be revalidated before checkout.

Cart does not create authoritative payment, fulfillment, reputation, or inventory history by itself.

The MVP may allow Products from multiple sellers in one buyer cart, but every resulting Order remains seller-scoped so seller management and future payouts stay unambiguous.

## Checkout and order creation

Checkout turns current cart intent into durable transaction records.

The source concept places Payment before the final purchased Order, while the source lifecycle also defines a `PENDING` Order state. Implementation therefore uses a durable `PENDING` order as the checkout/payment attempt. It is not treated as paid commerce.

Checkout must:
- authenticate the buyer
- reject self-purchase for the MVP
- require currently PUBLISHED Products
- require PUBLISHED seller ProfessionalProfile and ACTIVE HUSTLER capability
- validate selected ProductVariant where present
- validate positive quantity
- validate current stock when inventory tracking is enabled
- derive seller identity server-side
- derive price/currency server-side
- preserve transaction-critical item snapshots
- create seller-scoped Order records in `PENDING`

If a cart contains multiple sellers, checkout should partition it into separate seller Orders under one checkout attempt/reference rather than creating a mixed-seller Order.

## Historical transaction snapshot

Order history must not silently change when a Product listing changes later.

Each OrderItem preserves a narrow transaction snapshot:
- Product title
- Product type
- selected variant label/options where applicable
- SKU where applicable
- unit price in minor units
- currency
- quantity
- line total

Canonical Product/ProductVariant IDs remain attached.

Media, descriptions, follower counts, mutable stock and unrelated listing data should not be copied into OrderItem snapshots unless later evidence proves they are transaction-critical.

## Inventory boundary

Cart items do not reserve inventory.

Phase 12 checkout validates that requested stock appears available when the `PENDING` Order is created. A `PENDING` order must not pretend stock has been successfully purchased.

Authoritative inventory deduction for paid orders should occur atomically with the Phase 13 payment-confirmation integration so payment success and stock ownership do not drift apart.

Phase 13 must revalidate inventory before confirming `PAID`. If stock is no longer available, the payment workflow must fail safely rather than oversell or manufacture inventory.

## Payment boundary

Phase 13 owns real payment, transaction ledger, escrow where applicable, refunds, payouts, reconciliation, webhooks and idempotency.

Therefore Phase 12 must NOT:
- fake payment success
- expose a client endpoint that marks an Order `PAID`
- decrement paid inventory based only on a browser request
- create fake wallet/escrow state
- mark `REFUNDED` without authoritative financial evidence after payment

The server should expose a narrow internal integration boundary so Phase 13 can advance an eligible Order from `PENDING` to `PAID` only after authoritative payment confirmation.

## Fulfillment lifecycle

After authoritative payment:

Physical Product normal path:

`PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED`

Digital Product normal path may omit physical shipping:

`PAID → PROCESSING → DELIVERED → COMPLETED`

`SHIPPED` is not required for a digital item.

Seller fulfillment transitions must be server-authorized and order-specific.

## Cancellation and refund boundary

A buyer may cancel a `PENDING` order before authoritative payment under explicit rules.

After an Order becomes `PAID`, cancellation/refund semantics cross into Phase 13. Phase 12 must not simulate a financial refund by status change alone.

`REFUNDED` is authoritative financial state and requires the future payment/refund integration.

## Delivery information

Physical orders need transaction-specific delivery information rather than relying only on the mutable Product listing.

The MVP order may preserve:
- recipient name
- recipient phone/contact where required for delivery
- delivery address/location
- delivery instructions

This information is private transaction data and must never appear in public Product/Search/Feed payloads or analytics event text.

Digital orders may use product-defined digital delivery behavior later, but must not pretend a file/license was delivered when no fulfillment mechanism exists.

## Buyer experience

Buyer should be able to:
- add/remove/update cart items
- see current cart totals
- proceed to checkout
- provide delivery details when needed
- see `PENDING` order/payment boundary clearly
- view buyer order history
- open order details
- message the seller through the existing unified Messaging system

## Seller experience

An ACTIVE HUSTLER selling Products should be able to:
- see seller-scoped Orders for owned Products
- open order details
- see item snapshots and delivery requirements
- transition paid orders through valid fulfillment states
- message the buyer

Seller actions are relationship/capability based; there is no seller mode switch.

## Observability

Minimum Phase 12 events:
- `cart.item_added`
- `cart.item_updated`
- `cart.item_removed`
- `checkout.started`
- `order.created`
- `order.paid` — Phase 13 integration only
- `order.processing`
- `order.shipped`
- `order.delivered`
- `order.completed`
- `order.cancelled`
- `order.refunded` — authoritative Phase 13 integration only

Event payloads use IDs, quantities, non-sensitive totals/status and actor relationship. Do not copy private addresses/contact details into SystemEvent payloads.

## Phase boundaries

Phase 12 owns:
- Cart
- CartItem
- checkout validation
- PENDING Order creation
- OrderItem transaction snapshots
- buyer order history/detail
- seller order management
- fulfillment transitions after payment
- order/message linkage
- commerce observability

Phase 13 owns:
- payment gateway
- authoritative `PENDING → PAID`
- inventory deduction tied to payment confirmation
- ledger
- escrow where applicable
- refund execution and authoritative `REFUNDED`
- payout
- reconciliation
- webhooks/idempotency

Phase 14 owns verified reviews/reputation after completed transactions.

## Phase 12 build slices

### 12A — Cart + Order data foundation
- Cart
- CartItem
- Order
- OrderItem
- OrderStatus
- buyer/seller/Product/variant relationships
- transaction snapshots
- delivery fields
- indexes, integrity constraints, RLS and API-role policy

### 12B — Cart + checkout API
- get cart
- add item
- update quantity
- remove item
- clear cart
- checkout preview
- checkout creates PENDING seller-scoped Order(s)
- stock/variant/publication revalidation
- buyer order list/detail
- seller order list/detail
- payment integration boundary
- order events

### 12C — Cart + Orders web experience
- Product → Add to Cart
- Cart page
- checkout page
- order confirmation/detail
- buyer history
- seller order management
- message buyer/seller
- explicit payment boundary

### 12D — Fulfillment state engine
- PAID → PROCESSING
- physical: PROCESSING → SHIPPED → DELIVERED → COMPLETED
- digital: PROCESSING → DELIVERED → COMPLETED
- cancellation boundaries
- invalid/duplicate transition protection

### 12E — Real commerce gate
Before Phase 13 integration, validate real Product → Cart → Checkout → PENDING Order with no fake payment. After Phase 13 is available, extend the gate through authoritative payment, fulfillment and completion.
