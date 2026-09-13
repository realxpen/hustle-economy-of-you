# Hustle Project State

Updated: 2026-09-13

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
- Financial state must be server-authoritative and supported by verified provider/internal financial evidence.
- Never fake payment, funding, escrow, refunds, wallet credit, payout, delivery or completion.

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

## Current canonical transaction boundaries

Booking:
`REQUESTED → PAYMENT_PENDING → Phase 13 verified payment → FUNDED → IN_PROGRESS → COMPLETED`

Order:
`PENDING → Phase 13 verified payment + inventory deduction → PAID → PROCESSING → SHIPPED/DELIVERED → COMPLETED`

No browser endpoint may directly set `FUNDED`, `PAID`, `REFUNDED`, escrow release, wallet balance or payout success.

## Finance ownership now built

Financial entities:
- `PaymentAttempt`
- `LedgerAccount`
- `LedgerTransaction`
- `LedgerPosting`
- `EscrowRecord`
- `Payout`
- `Refund`
- `WebhookEvent`

Financial infrastructure:
- provider-neutral `PaymentGatewayPort`
- `HUSTLE_SANDBOX` adapter
- HMAC-SHA256 verified webhook ingress
- idempotent payment initialization
- provider event deduplication
- exact amount/currency/reference verification
- balanced capture ledger postings
- server-only Booking funding integration
- server-only Order paid/inventory integration
- ledger-backed wallet projection

## Supabase
Dedicated project:
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`

Latest hosted migration:
- `20260911143316 phase13_financial_foundation`

Financial tables have RLS enabled with direct access restricted to the dedicated `hustle_api` role.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Node: 22.x via `.nvmrc`
- Auth/database/storage: hosted Hustle Supabase

Secrets and `.env` files remain local and must never be committed.
Sandbox webhook verification requires server-only `HUSTLE_SANDBOX_WEBHOOK_SECRET`.

## Repository workflow
ChatGPT implements and commits directly to `realxpen/hustle-economy-of-you`. Project owner pulls and runtime-validates locally at checkpoints.

Before pulling:
1. `git status`
2. commit/push intentional local source changes only
3. do not blindly commit generated files

`apps/web/next-env.d.ts` is generated and should normally be restored after builds rather than committed.

# Phase 13 implementation

Canonical knowledge:
- `Knowledge/Product/PAYMENTS_AND_ESCROW.md`
- `Knowledge/Decisions/ADR-0012-payment-authority-ledger-and-escrow.md`
- `Knowledge/Technical/PAYMENT_SANDBOX_FOUNDATION.md`
- `Knowledge/Technical/WALLET_ESCROW_SETTLEMENT.md`

### 13A — Financial data foundation
IMPLEMENTED; HOSTED MIGRATION APPLIED; RUNTIME GATE DEFERRED TO CONSOLIDATED CHECKPOINT.

Built:
- payment attempts
- ledger accounts/transactions/postings
- escrow state
- payout/refund durable records
- webhook audit/dedup records
- uniqueness + idempotency constraints
- financial RLS/API-role policies

### 13B — Payment gateway foundation
IMPLEMENTED; CI PASSED; RUNTIME GATE DEFERRED TO CONSOLIDATED CHECKPOINT.

Built:
- payment initialization for BOOKING and ORDER subjects
- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:paymentAttemptId`
- `POST /api/v1/payments/webhooks/sandbox`
- server-derived payer, beneficiary, amount and currency
- signed webhook verification
- payment success/failure handling
- duplicate event protection
- Booking `PAYMENT_PENDING → FUNDED` authoritative integration
- Order `PENDING → PAID` authoritative integration with inventory deduction
- ledger capture + Service escrow hold / Product pending proceeds

### 13C — Escrow + Wallet
IMPLEMENTED; CI/RUNTIME GATE PENDING.

Built:
- ledger-backed wallet projection
- `GET /api/v1/wallet`
- `GET /api/v1/wallet/transactions`
- Booking escrow release after durable `COMPLETED` + `HELD` state
- Product settlement release after durable `COMPLETED` + authoritative applied payment
- balanced `ESCROW → AVAILABLE` movement
- balanced `PENDING → AVAILABLE` movement
- idempotent release references
- `escrow.released` and `settlement.released` observations
- `/wallet` web surface
- Account → Wallet navigation

Server-validated release endpoints:
- `POST /api/v1/wallet/escrows/bookings/:bookingId/release`
- `POST /api/v1/wallet/settlements/orders/:orderId/release`

### 13D — Payout + Refund + Reconciliation
NEXT.

Build next:
- withdrawal/payout request
- atomic available-balance reservation
- sandbox payout confirmation/failure
- authoritative refund request/confirmation
- compensating ledger entries
- domain `REFUNDED` integration
- reconciliation report/tools
- duplicate/out-of-order protection

### 13E — Financial web experience
PENDING.

Build:
- payment initiation/status/retry
- withdrawal flow
- escrow/refund/payout status
- recovery/reconciliation surfaces

### 13F — Sandbox money gate
PENDING until project owner is back at the development machine.

Consolidated service gate:
`PAYMENT_PENDING → verified payment → HELD → FUNDED → work → COMPLETED → RELEASED → AVAILABLE → payout`

Consolidated Product gate:
`PENDING → verified payment + inventory deduction → PAID → fulfillment → COMPLETED → AVAILABLE`

Also validate duplicate webhook safety, stale/invalid payment rejection, inventory race safety, refunds, payout failure/retry and reconciliation.

## Next build target
**Phase 13D — payout + refund + reconciliation.**
