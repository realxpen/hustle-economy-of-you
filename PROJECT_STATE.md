# Hustle Project State

Updated: 2026-09-13

## Current AED capability
Build

## Current MVP phase
Phase 13 — Payments + Escrow

Phase 13 code is implemented through 13E. Runtime financial validation remains intentionally deferred to the consolidated sandbox gate before Phase 13 may be closed.

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Financial state is server-authoritative.
- Never fake payment, funding, escrow, refunds, wallet credit, payout, delivery or completion.
- Browser/mobile clients may request financial operations, but verified provider/internal durable evidence determines success.

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

## Current transaction boundaries

Booking:
`REQUESTED → PAYMENT_PENDING → verified payment → FUNDED → IN_PROGRESS → COMPLETED → escrow release → Hustler AVAILABLE`

Order:
`PENDING → verified payment + inventory deduction → PAID → PROCESSING → SHIPPED/DELIVERED → COMPLETED → seller AVAILABLE`

Money:
`payment confirmation → ledger → escrow/pending → available → payout reservation → provider-confirmed payout`

## Canonical Phase 13 knowledge
- `Knowledge/Product/PAYMENTS_AND_ESCROW.md`
- `Knowledge/Decisions/ADR-0012-payment-authority-ledger-and-escrow.md`
- `Knowledge/Technical/PAYMENT_SANDBOX_FOUNDATION.md`
- `Knowledge/Technical/WALLET_ESCROW_SETTLEMENT.md`
- `Knowledge/Technical/PAYOUT_REFUND_RECONCILIATION.md`
- `Knowledge/Technical/FINANCIAL_WEB_EXPERIENCE.md`

## Phase 13A — Financial data foundation
IMPLEMENTED; HOSTED MIGRATION APPLIED; runtime gate pending.

Financial records:
- `PaymentAttempt`
- `LedgerAccount`
- `LedgerTransaction`
- `LedgerPosting`
- `EscrowRecord`
- `Payout`
- `Refund`
- `WebhookEvent`

Hosted migration:
- `20260911143316 phase13_financial_foundation`

Financial tables have RLS enabled and direct DB policies are restricted to `hustle_api`.

## Phase 13B — Payment gateway foundation
IMPLEMENTED; CI PASSED; runtime gate pending.

API:
- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:paymentAttemptId`
- `GET /api/v1/payments/subjects/:subjectType/:subjectId/latest`
- `POST /api/v1/payments/webhooks/sandbox`

Built:
- provider-neutral collection port
- HUSTLE_SANDBOX payment adapter
- required initialization idempotency
- server-derived payer, beneficiary, amount and currency
- HMAC-SHA256 webhook verification
- duplicate provider-event protection
- exact reference/amount/currency validation
- Booking `PAYMENT_PENDING → FUNDED` server integration
- Order `PENDING → PAID` server integration with inventory revalidation/deduction
- balanced payment-capture ledger postings
- Service escrow `HELD`
- Product seller `PENDING` proceeds
- recoverable domain-application state through `domainAppliedAt`

## Phase 13C — Escrow + Wallet
IMPLEMENTED; CI PASSED; runtime gate pending.

API:
- `GET /api/v1/wallet`
- `GET /api/v1/wallet/transactions`
- `POST /api/v1/wallet/escrows/bookings/:bookingId/release`
- `POST /api/v1/wallet/settlements/orders/:orderId/release`

Built:
- ledger-derived AVAILABLE / PENDING / ESCROW / PAYOUT_RESERVED buckets
- Booking escrow HELD → RELEASED with ESCROW debit → AVAILABLE credit
- Product settlement PENDING debit → AVAILABLE credit after completed Order
- idempotent release keys
- `escrow.released`
- `settlement.released`
- `/wallet` web surface

## Phase 13D — Payout + Refund + Reconciliation
IMPLEMENTED; CI PASSED; runtime gate pending.

API:
- `POST /api/v1/wallet/withdrawals`
- `GET /api/v1/wallet/withdrawals`
- `POST /api/v1/wallet/refunds`
- `GET /api/v1/wallet/refunds`
- `GET /api/v1/wallet/reconciliation`
- `POST /api/v1/payments/webhooks/sandbox-operations`

Built:
- atomic withdrawal reservation from AVAILABLE → PAYOUT_RESERVED
- signed provider payout success/failure
- successful payout removes reserved funds to provider-clearing account
- failed payout restores reserved funds to AVAILABLE
- full authoritative refund workflow
- Booking HELD escrow → REFUND_PENDING → REFUNDED or restored HELD on failure
- Order PAID refund with tracked inventory restoration exactly once
- compensating refund ledger postings
- stale/duplicate operation event handling
- user-scoped reconciliation for unapplied payments, pending operations, failed webhooks, negative balances and unbalanced ledger transactions
- `payout.requested`, `payout.confirmed`, `payout.failed`
- `refund.requested`, `refund.confirmed`, `refund.failed`

## Phase 13E — Financial web experience
IMPLEMENTED; CI PASSED; browser/runtime gate pending.

Web:
- `/wallet` balances, history, withdrawals, refund status and reconciliation health
- Account → Wallet navigation
- Booking detail financial controls
- Order detail financial controls
- payment initialization/status/retry
- refund request controls
- Booking escrow release control
- Order settlement release control
- session-scoped idempotency keys for browser retries
- durable latest-payment recovery after refresh

The web experience does not contain any control that directly declares provider success.

## Phase 13F — Sandbox money gate
PENDING. This is the only remaining Phase 13 closure gate.

Service gate:
`PAYMENT_PENDING → signed payment success → PaymentAttempt SUCCEEDED → escrow HELD → Booking FUNDED → work → COMPLETED → escrow RELEASED → AVAILABLE → payout reserve → signed payout success`

Product gate:
`PENDING Order → signed payment success → inventory deduction → PAID → fulfillment → COMPLETED → seller PENDING → AVAILABLE → payout`

Refund gate:
- eligible Booking refund produces authoritative REFUNDED + escrow compensation
- eligible PAID Order refund produces authoritative REFUNDED + inventory restoration
- failed refund restores safe internal state

Resilience gate:
- unsigned/invalid webhook rejected
- wrong amount/currency rejected
- duplicate webhook does not duplicate money/inventory
- stale failure after success ignored
- insufficient withdrawal balance rejected
- payout failure restores reserved funds
- reconciliation reports expected pending anomalies and returns healthy after resolution

Helper:
- `scripts/phase13-sandbox-event.sh` generates and sends locally signed sandbox financial events and pipes JSON through `jq` without printing the secret.

## Supabase
Dedicated project:
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`

Auth/database/storage remain hosted in the dedicated Hustle project.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin reserved: `http://localhost:3002`
- Node: 22.x via `.nvmrc`

Secrets and `.env` files remain local and must never be committed.
Server-only sandbox webhook verification requires `HUSTLE_SANDBOX_WEBHOOK_SECRET`.

## Repository workflow
ChatGPT commits directly to `realxpen/hustle-economy-of-you`. Runtime validation is accumulated for the project owner's next development-machine checkpoint.

Before pulling:
1. `git status`
2. commit/push intentional local source changes only
3. `git pull --rebase origin main`
4. use Node 22
5. restore generated `apps/web/next-env.d.ts` after builds rather than committing it

Use fresh auth sessions/tokens for the Phase 13 sandbox gate. Previously pasted access tokens must not be reused.

## Next gate
**Phase 13F — consolidated sandbox money validation. Do not close Phase 13 or open Phase 14 until this gate is runtime-validated.**
