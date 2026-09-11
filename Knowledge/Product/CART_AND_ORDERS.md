# Cart + Orders

Status: CANONICAL — Phase 12 COMPLETE AT PHASE 13 PAYMENT BOUNDARY
Updated: 2026-09-11

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

## Identity and ownership

Hustle keeps one unified User identity.

A buyer is the existing User acting as purchaser. A seller is the existing User who owns the Product through ProfessionalProfile and ACTIVE HUSTLER capability.

No buyer account, seller account, shop mode or role switcher exists.

Canonical relationships:

`User → Cart → CartItem → Product / optional ProductVariant`

`User (buyer) → Order`

`User (seller) → Order`

`Order → OrderItem → Product / optional ProductVariant`

## Cart semantics

Cart is mutable purchase intent, not transaction history.

CartItem references canonical Product and optional ProductVariant plus quantity. Price, publication, variant activity and stock are revalidated before checkout.

Cart does not create authoritative payment, fulfillment, reputation or inventory ownership.

A buyer cart may contain Products from multiple sellers, but checkout partitions into separate seller-scoped Orders.

## Checkout and historical snapshot

Checkout creates durable `PENDING` Order records. `PENDING` is not treated as paid commerce.

Checkout derives seller, price and currency server-side, validates current Product/variant/seller/stock state, rejects self-purchase and preserves transaction-critical item snapshots:
- Product title
- Product type
- selected variant/options/SKU
- unit price minor units
- quantity
- line total

Currency is stored on the seller-scoped Order. Canonical Product/ProductVariant IDs remain attached.

## Inventory + payment boundary

Cart items and `PENDING` Orders do not reserve inventory.

Phase 13 owns authoritative `PENDING → PAID`.

At payment confirmation, Phase 13 must revalidate inventory and coordinate tracked inventory deduction atomically with the authoritative payment transition.

Phase 12 never:
- fakes payment success
- exposes a browser route to set `PAID`
- marks `REFUNDED` without financial evidence
- creates fake wallet/escrow state

The server integration boundary is `CommerceService.markPaidFromAuthoritativePayment(...)`.

## Fulfillment lifecycle and authority

Physical normal path:

`PAID → PROCESSING → SHIPPED → DELIVERED → COMPLETED`

Digital-only normal path:

`PAID → PROCESSING → DELIVERED → COMPLETED`

A seller-scoped Order containing any PHYSICAL item follows the physical path.

Authority:
- seller + ACTIVE HUSTLER: `PAID → PROCESSING`
- seller: physical `PROCESSING → SHIPPED`
- seller: delivery transition
- buyer: `DELIVERED → COMPLETED`
- buyer or seller: `PENDING → CANCELLED`

Transitions use compare-and-set against current status so repeated, stale, skipped or out-of-order actions fail.

## Cancellation and refund boundary

A `PENDING` Order may be cancelled by either participant before authoritative payment.

`PENDING → CANCELLED` is not a refund because payment has not occurred.

After `PAID`, cancellation/refund crosses into Phase 13. Phase 12 rejects paid-order cancellation instead of manufacturing refund state.

`REFUNDED` requires authoritative financial evidence.

## Delivery privacy

Physical Orders preserve private recipient/contact/address/instructions on the participant-authorized Order record.

Private delivery data must never appear in public Product/Search/Feed payloads or analytics event text.

## Buyer experience

Buyer can:
- add/remove/update Cart items
- checkout with required delivery details
- view `PENDING` payment boundary
- view Order history/detail
- cancel unpaid PENDING Orders
- confirm completion only after DELIVERED
- message seller

## Seller experience

ACTIVE HUSTLER seller can:
- view seller-scoped Orders
- inspect snapshots/delivery requirements
- cancel unpaid PENDING Orders
- transition paid Orders through valid fulfillment states
- message buyer

There is no seller mode switch.

## Observability

Phase 12 events include:
- `cart.item_added`
- `cart.item_updated`
- `cart.item_removed`
- `checkout.previewed`
- `cart.checked_out`
- `order.created`
- `order.processing`
- `order.shipped`
- `order.delivered`
- `order.completed`
- `order.cancelled`

Phase 13 owns authoritative:
- `order.paid`
- `order.refunded`

Private delivery data is excluded from SystemEvent payloads.

## Build status

### 12A — Cart + Order data foundation
COMPLETE; hosted migration applied; runtime validated.

### 12B — Cart + checkout API
COMPLETE; CI + runtime validated.

Validated real API gate:
- `adminxpen` added `Hustle Creator T-Shirt` / `Large/Black`
- quantity updated to 3
- checkout preview resolved seller `xpen` and ₦45,000 subtotal
- checkout created Order `cmtwre2ur000wdcclebkqiynp`
- immutable Product/variant/SKU/price/quantity snapshot persisted
- Cart cleared after checkout
- buyer and seller both retrieved the same Order
- quantity 6 rejected against stock 5
- quantity 1 remained addable after checkout, proving PENDING does not reserve inventory

### 12C — Cart + Orders web experience
COMPLETE; CI + browser runtime validated.

Validated:
`Product → variant/quantity → Cart → checkout → delivery → PENDING Order → buyer history → seller visibility → Order detail → Messaging`

No browser payment/PAID action exists.

### 12D — Fulfillment state engine
COMPLETE; CI + runtime validated at the pre-payment boundary.

Endpoints:
- `POST /api/v1/orders/:orderId/process`
- `POST /api/v1/orders/:orderId/ship`
- `POST /api/v1/orders/:orderId/deliver`
- `POST /api/v1/orders/:orderId/complete`
- `POST /api/v1/orders/:orderId/cancel`

Validated on real Order `cmtwre2ur000wdcclebkqiynp`:
- buyer calling `/process` → 403
- seller calling `/complete` → 403
- seller calling `/process` while PENDING → 409
- seller calling `/ship` while PENDING → 409
- buyer PENDING cancellation → `CANCELLED`
- duplicate cancellation → 409
- final state remained `CANCELLED`
- `paidAt`, `processingAt`, `shippedAt`, `deliveredAt`, `completedAt`, `refundedAt` remained null
- hosted `order.cancelled` event persisted with buyer relationship and no private delivery data
- browser reflected CANCELLED state and removed cancellation action

## Phase 12 gate

The honest pre-payment Phase 12 gate is COMPLETE:

`Product → Cart → Checkout → durable PENDING Order → buyer/seller visibility → explicit payment boundary → safe pre-payment cancellation`

The complete paid commerce gate intentionally continues in Phase 13:

`PENDING → authoritative PAID + inventory deduction → PROCESSING → SHIPPED/DELIVERED → COMPLETED → authoritative refund when applicable`

## Phase boundary

Phase 13 now owns:
- payment gateway
- authoritative `PENDING → PAID`
- inventory deduction tied to payment confirmation
- ledger
- escrow where applicable
- wallet
- payout
- authoritative refund
- reconciliation
- webhooks
- idempotency

Canonical Phase 13 knowledge:
- `Knowledge/Product/PAYMENTS_AND_ESCROW.md`
- `Knowledge/Decisions/ADR-0012-payment-authority-ledger-and-escrow.md`
