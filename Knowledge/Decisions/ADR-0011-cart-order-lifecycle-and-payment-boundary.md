# ADR-0011 — Cart, Order lifecycle, seller scope, and payment boundary

Status: Accepted
Date: 2026-09-10

## Context

Hustle now has a public Product marketplace but no real product transaction flow yet.

The approved MVP source defines Phase 12 as:

`Product → Add to Cart → Checkout → Payment → Order created → Processing → Delivery → Completed`

with order statuses:

`PENDING, PAID, PROCESSING, SHIPPED, DELIVERED, COMPLETED, CANCELLED, REFUNDED`.

It also requires cart, checkout, order details, seller order management and buyer order history.

Phase 13 separately owns real payment and escrow infrastructure. We therefore need a durable commerce model in Phase 12 without manufacturing financial success.

## Decision

### 1. Cart is mutable buyer intent; Order is durable transaction state

Cart and Order are separate concepts.

Cart may change freely before checkout. Order history must remain stable after checkout.

### 2. One unified User identity remains authoritative

Buyer and seller are relationships on the same User model.

No buyer account, seller account, storefront account mode, or role switcher is introduced.

A seller must be the Product owner through ProfessionalProfile and retain ACTIVE HUSTLER capability.

### 3. Orders are seller-scoped

One Order belongs to exactly one buyer and one seller.

A buyer cart may contain Products from multiple sellers. At checkout, Hustle partitions the cart into separate seller-scoped Orders under the same checkout attempt/reference.

This keeps fulfillment, authorization, messaging, future settlement and seller order management unambiguous without forcing a one-seller cart UX.

### 4. `PENDING` is the durable pre-payment order state

Although the conceptual source flow places Payment before the final purchased Order, the source also explicitly defines `PENDING` as an Order status.

Hustle therefore creates a durable `PENDING` Order at checkout as the transaction/payment attempt. It is not treated as a successful purchase.

The authoritative transition into `PAID` belongs to Phase 13.

### 5. Phase 12 cannot fake `PAID` or `REFUNDED`

No public browser/client endpoint may set `PAID` or `REFUNDED`.

Phase 12 will expose internal server integration boundaries for Phase 13 to:
- confirm eligible PENDING Orders as PAID after verified payment
- confirm eligible paid Orders as REFUNDED after verified refund execution

### 6. OrderItem preserves a narrow transaction snapshot

Each OrderItem retains canonical Product/ProductVariant IDs plus transaction-critical historical values:
- product title
- product type
- selected variant/options/SKU when applicable
- unit price minor units
- currency
- quantity
- line total

Mutable listing content remains canonical on Product and is not broadly duplicated.

### 7. Cart does not reserve stock

Adding to Cart does not reserve inventory.

Checkout validates current Product/variant stock before creating the PENDING Order.

Authoritative inventory deduction is deferred to the Phase 13 payment-confirmation transaction so payment confirmation and inventory ownership can be coordinated atomically.

Phase 13 must revalidate stock before PAID. A stale PENDING Order must fail safely if inventory is no longer available.

### 8. Fulfillment is explicit and server-authoritative

Physical normal path:

`PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED`

Digital normal path:

`PAID → PROCESSING → DELIVERED → COMPLETED`

`SHIPPED` is optional/not applicable for digital Products.

Seller fulfillment actions derive from sellerUserId + ACTIVE HUSTLER capability and valid current status.

### 9. Financial cancellation/refund boundaries remain explicit

A buyer may cancel a PENDING Order under Phase 12 rules.

Once PAID, cancellation/refund requires Phase 13 financial logic. Phase 12 must never represent a refund as successful merely by changing an enum.

### 10. Messaging is reused

Order details may link/open the existing direct conversation between buyer and seller. Order state remains authoritative in Order; chat cannot mutate commerce state.

### 11. Commerce events are observable without leaking private delivery data

SystemEvent may record cart/order IDs, product IDs, quantities, totals and lifecycle status.

Private address/contact/delivery instructions must not be copied into analytics payloads.

## Consequences

### Positive
- Product commerce gets explicit lifecycle state before payment integration.
- No fake financial success enters Hustle.
- Seller fulfillment stays unambiguous.
- A multi-seller cart remains possible without creating mixed-seller Orders.
- Transaction history survives later Product edits.
- Phase 13 can integrate payment/inventory/refunds without redesigning ownership.

### Tradeoffs
- Phase 12 alone cannot honestly prove end-to-end purchase success through PAID.
- Cart stock is not guaranteed until payment confirmation.
- Checkout may create multiple Orders for one cart when multiple sellers are involved.
- Full paid commerce gate is intentionally split across Phase 12 + Phase 13.

## Rejected alternatives

### One Order containing items from multiple sellers
Rejected because seller authorization, fulfillment, settlement and future disputes become ambiguous.

### Reserve/decrement stock when item enters Cart
Rejected because abandoned carts would lock inventory and require expiry/reservation infrastructure before evidence justifies it.

### Mark Order PAID from frontend checkout
Rejected because financial state must come from authoritative Phase 13 payment confirmation.

### Copy the whole Product into OrderItem
Rejected because only transaction-critical historical terms need snapshots; the canonical Product remains the listing source.

### Create separate buyer and seller accounts
Rejected because Hustle uses one User identity with additive capabilities and no role switching.
