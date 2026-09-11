# Hustle Project State

Updated: 2026-09-11

## Current AED capability
Build

## Current MVP phase
Phase 13 — Payments + Escrow

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Content demonstrates capability and connects discovery to economic opportunity.
- Services and Products attach to content through canonical relationships.
- Trust and verified outcomes outrank vanity metrics.
- Transaction state must be explicit; never fake payment, funding, escrow, refunds, delivery, completion or payout success.
- Financial state must be server-authoritative and supported by verified provider/internal financial evidence.

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
- Phase 11 — Booking System: COMPLETE at Phase 13 payment boundary
- Phase 12 — Cart + Orders: COMPLETE at Phase 13 payment boundary

## Phase 11 retained boundary
Real booking flow is validated through `PAYMENT_PENDING`.
Phase 13 provides authoritative payment + escrow before Booking may become `FUNDED`.

Canonical:
- `Knowledge/Product/BOOKING_SYSTEM.md`
- `Knowledge/Decisions/ADR-0010-booking-lifecycle-and-payment-boundary.md`

## Phase 12 retained boundary
Real Product commerce is validated through durable `PENDING` Order plus fulfillment/cancellation authorization rules.
Paid lifecycle is unlocked only by Phase 13 verified payment plus inventory ownership.

Canonical:
- `Knowledge/Product/CART_AND_ORDERS.md`
- `Knowledge/Decisions/ADR-0011-cart-order-lifecycle-and-payment-boundary.md`

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
- Conversation / participants / messages
- private message attachments
- canonical Post/Service/Product context
- ephemeral typing presence

Booking:
- first-class Booking entity
- client + Hustler + Service ownership
- optional Conversation link
- historical terms snapshot
- server-authoritative scheduling conflicts
- paid Booking stops at `PAYMENT_PENDING` until verified financial confirmation

Commerce:
- one Cart per User
- seller-scoped Orders
- immutable transaction-critical OrderItem snapshots
- PENDING Orders do not reserve stock
- server-authoritative fulfillment engine
- pre-payment cancellation only
- paid Order stops at `PENDING` until verified financial confirmation

Finance:
- PaymentAttempt
- LedgerAccount
- LedgerTransaction + balanced LedgerPosting records
- EscrowRecord
- durable Payout and Refund workflow records
- WebhookEvent deduplication/audit record
- provider-neutral PaymentGatewayPort
- HUSTLE_SANDBOX adapter with HMAC-verified webhook ingress
- server-only Booking funding integration
- server-only Order payment + inventory integration

Observation:
- `SystemEvent`

## Supabase
Dedicated project:
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
- `phase12_cart_order_foundation` — `20260910144537`
- `phase13_financial_foundation` — `20260911143316`

Phase 13 financial tables have RLS enabled and only the dedicated `hustle_api` policy for direct database access.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Node: 22.x via `.nvmrc`
- Auth/database/storage: hosted Hustle Supabase

Secrets and `.env` files remain local and must never be committed.
Phase 13 sandbox webhook verification requires server-only `HUSTLE_SANDBOX_WEBHOOK_SECRET`.

## Repository workflow
ChatGPT may implement and commit directly to `realxpen/hustle-economy-of-you`. Project owner pulls and validates locally.

Before pulling remote work:
1. `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`*.tsbuildinfo` is ignored. `apps/web/next-env.d.ts` is generated and should normally be restored rather than committed after builds.

# Phase 12 validation evidence

Real Order:
- ID `cmtwre2ur000wdcclebkqiynp`
- buyer `adminxpen`
- seller `xpen`
- Product `Hustle Creator T-Shirt`
- variant `Large/Black`
- subtotal ₦45,000

Validated:
- Product → Cart → Checkout → PENDING Order
- buyer/seller relationship views
- immutable transaction snapshot
- stock validation
- PENDING does not reserve stock
- no browser PAID action
- buyer cannot process Order
- seller cannot confirm buyer completion
- PENDING cannot process or ship
- PENDING cancellation succeeds
- repeated cancellation is rejected
- final hosted state `CANCELLED`
- `paidAt`, `processingAt`, `shippedAt`, `deliveredAt`, `completedAt`, `refundedAt` all remain null
- hosted `order.cancelled` SystemEvent persisted without private delivery data
- browser reflects cancelled state

Therefore Phase 12 is closed honestly at the Phase 13 payment boundary.

# Phase 13 — Payments + Escrow

## Objective
Solve the trust problem around money.

Source flow for Services:

`Client pays → Payment confirmed → Funds held → Service performed → Completion confirmed → Funds released → Hustler receives payout`

Source build scope:
- payment gateway
- transaction ledger
- escrow state
- wallet balance
- payout
- refund
- reconciliation
- webhooks
- idempotency

MVP Wallet:
- Available balance
- Pending balance
- Escrow
- Transactions
- Withdraw

Source gate:

`Money can move safely through a full sandbox transaction before production.`

Canonical knowledge:
- `Knowledge/Product/PAYMENTS_AND_ESCROW.md`
- `Knowledge/Decisions/ADR-0012-payment-authority-ledger-and-escrow.md`
- `Knowledge/Technical/PAYMENT_SANDBOX_FOUNDATION.md`

## Locked financial architecture
- one common financial layer for BOOKING and ORDER subjects
- provider-neutral payment adapter/port
- provider secrets server-side only
- PaymentAttempt tracks provider collection workflow
- append-only ledger transactions with balanced postings
- escrow state is separate from payment status and Booking status
- wallet remains a ledger-backed projection/read model, not a client-editable balance
- verified webhook/provider response/reconciliation is authoritative
- duplicate/out-of-order events must be idempotent
- refunds/payouts require authoritative financial confirmation
- production activation is a separate human risk gate after sandbox validation

## Phase 13 implementation status

### 13A — Financial data foundation
IMPLEMENTED; HOSTED MIGRATION APPLIED; RUNTIME GATE PENDING.

Built:
- `PaymentAttempt`
- `LedgerAccount`
- `LedgerTransaction`
- `LedgerPosting`
- `EscrowRecord`
- `Payout`
- `Refund`
- `WebhookEvent`
- financial enums/states
- unique provider/idempotency constraints
- positive money constraints
- ledger posting/account indexes
- subject/payment indexes
- RLS on every financial table
- dedicated `hustle_api` policies only

Wallet projection remains derived from ledger accounts/postings; wallet API/UI is Phase 13C.

Hosted migration:
- `20260911143316 phase13_financial_foundation`

### 13B — Payment gateway foundation
IMPLEMENTED; CI PASSED; RUNTIME GATE PENDING.

Built:
- `PaymentGatewayPort`
- `SandboxPaymentGateway` provider-neutral adapter implementation
- HMAC-SHA256 verified sandbox financial webhook ingress
- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:paymentAttemptId`
- `POST /api/v1/payments/webhooks/sandbox`
- required `Idempotency-Key` on payment initialization
- server-derived payer/beneficiary/amount/currency
- active payment-attempt reuse to prevent parallel duplicate collection
- provider event deduplication
- exact amount/currency/provider verification
- authoritative success/failure transitions
- balanced ledger capture posting exactly once
- BOOKING success creates HELD escrow then calls server-only Booking funding boundary
- ORDER success calls server-only Order payment/inventory boundary then posts seller PENDING funds
- domain-application timestamp supports recovery/reconciliation when external success and internal business transition temporarily diverge
- `reconciliation.mismatch` observation on domain application failure

Current financial SystemEvent vocabulary:
- `payment.initiated`
- `payment.confirmed`
- `payment.failed`
- `escrow.held`
- `reconciliation.mismatch`

GitHub CI after the implementation passed:
- locked install
- web/admin/mobile typechecks
- Prisma generate
- API typecheck
- web/admin/API builds

### 13C — Escrow + Wallet
PENDING.

Build:
- escrow release after valid completion
- available/pending/escrow balances
- wallet API
- transaction history

### 13D — Payout + Refund + Reconciliation
PENDING.

Build:
- withdrawal/payout
- payout confirmation/failure
- authoritative refunds
- compensating ledger entries
- reconciliation tools/jobs
- duplicate/out-of-order tests

### 13E — Financial web experience
PENDING.

Build:
- payment initiation/status/retry UI
- wallet
- transactions
- withdraw
- escrow/refund/payout state

### 13F — Sandbox money gate
PENDING.

Immediate 13A/B validation:
- initialize a fresh Booking payment as its client
- reject initialization by non-payer
- reject missing/invalid sandbox webhook signature
- signed Booking success produces PaymentAttempt SUCCEEDED + ledger + HELD escrow + Booking FUNDED exactly once
- initialize a fresh Order payment as its buyer
- signed Order success revalidates/deducts inventory + Order PAID + ledger exactly once
- duplicate signed event does not duplicate state/money/inventory
- wrong amount/currency is rejected
- signed failure leaves subject unfunded/unpaid

Full Phase 13F service gate:
`Booking PAYMENT_PENDING → payment confirmed → escrow HELD → FUNDED → work → completion → escrow RELEASED → available balance → payout`

Full Phase 13F product gate:
`Order PENDING → payment confirmed + inventory deduction → PAID → fulfillment → COMPLETED`

## Next gate
**Runtime-validate Phase 13A + 13B, then build Phase 13C escrow release + wallet projection/API.**
