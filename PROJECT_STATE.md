# Hustle Project State

Updated: 2026-09-14

## Current AED capability
Build

## Current MVP phase
Phase 13 — Payments + Escrow — CLOSURE CANDIDATE

Phase 13A–13F are implemented and the full sandbox money-flow gate has been runtime-validated. One final schema/ledger taxonomy migration verification remains before Phase 13 is marked COMPLETE and Phase 14 opens.

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
IMPLEMENTED; HOSTED MIGRATION APPLIED; runtime validated.

Financial records:
- `PaymentAttempt`
- `LedgerAccount`
- `LedgerTransaction`
- `LedgerPosting`
- `EscrowRecord`
- `Payout`
- `Refund`
- `WebhookEvent`

Original hosted Phase 13 financial-foundation migration is applied.

Phase 13 finalization adds `PAYOUT` as a ledger subject and backfills the early sandbox placeholder representation (`ORDER` + `PAYOUT:<id>`). These two finalization migrations must be applied and smoke-tested before Phase 13 is marked COMPLETE.

Financial tables have RLS enabled and direct DB policies are restricted to `hustle_api`.

## Phase 13B — Payment gateway foundation
IMPLEMENTED; RUNTIME VALIDATED.

API:
- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:paymentAttemptId`
- `GET /api/v1/payments/subjects/:subjectType/:subjectId/latest`
- `POST /api/v1/payments/webhooks/sandbox`

Built and validated:
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

Runtime defect discovered and fixed:
- a verified `payment.succeeded` could reach `SUCCEEDED` while internal domain application failed because Prisma's default interactive-transaction timeout was too short for the multi-write payment-capture path
- payment capture now uses explicit `maxWait: 10_000` and `timeout: 30_000`
- replaying the exact same verified event completed domain application without a second charge

## Phase 13C — Escrow + Wallet
IMPLEMENTED; RUNTIME VALIDATED.

API:
- `GET /api/v1/wallet`
- `GET /api/v1/wallet/transactions`
- `POST /api/v1/wallet/escrows/bookings/:bookingId/release`
- `POST /api/v1/wallet/settlements/orders/:orderId/release`

Validated:
- ledger-derived AVAILABLE / PENDING / ESCROW / PAYOUT_RESERVED buckets
- Booking escrow HELD → RELEASED with ESCROW debit → AVAILABLE credit
- Product settlement PENDING debit → AVAILABLE credit after completed Order
- idempotent release keys
- `escrow.released`
- `settlement.released`
- `/wallet` web surface

## Phase 13D — Payout + Refund + Reconciliation
IMPLEMENTED; RUNTIME VALIDATED.

API:
- `POST /api/v1/wallet/withdrawals`
- `GET /api/v1/wallet/withdrawals`
- `POST /api/v1/wallet/refunds`
- `GET /api/v1/wallet/refunds`
- `GET /api/v1/wallet/reconciliation`
- `POST /api/v1/payments/webhooks/sandbox-operations`

Validated:
- atomic withdrawal reservation from AVAILABLE → PAYOUT_RESERVED
- signed provider payout success/failure
- successful payout removes reserved funds to provider-clearing account
- failed payout restores reserved funds to AVAILABLE exactly once
- full authoritative refund workflow
- Booking HELD escrow → REFUND_PENDING → REFUNDED
- Order PAID refund with tracked inventory restoration exactly once
- compensating refund ledger postings
- stale/duplicate operation event handling
- user-scoped reconciliation for unapplied payments, pending operations, failed webhooks, negative balances and unbalanced ledger transactions
- `payout.requested`, `payout.confirmed`, `payout.failed`
- `refund.requested`, `refund.confirmed`, `refund.failed`

Ledger taxonomy finalization:
- payout reservation/sent/reversal entries now use `FinancialSubjectType.PAYOUT`
- payout ledger `subjectId` is the durable payout ID
- collection/refund API subjects remain restricted to BOOKING/ORDER

## Phase 13E — Financial web experience
IMPLEMENTED; code complete.

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
PASSED — 2026-09-14.

Service path validated:
`PAYMENT_PENDING → signed payment success → PaymentAttempt SUCCEEDED → escrow HELD → Booking FUNDED → work → COMPLETED → escrow RELEASED → AVAILABLE → payout reserve → signed payout success`

Product path validated:
`PENDING Order → signed payment success → inventory deduction → PAID → fulfillment → COMPLETED → seller PENDING → AVAILABLE → payout`

Refund validation:
- Booking refund: authoritative refund moved Booking `FUNDED → REFUNDED`, removed held escrow, duplicate webhook made no second compensation
- Order refund: tracked variant stock moved `4 → 3` on authoritative payment and `3 → 4` on authoritative refund; duplicate refund webhook left inventory at `4`

Payout validation:
- successful payout completed
- failed payout restored reserved funds to AVAILABLE
- exact failure webhook replay did not restore funds twice

Resilience/reconciliation validation:
- duplicate payment/refund/payout events are idempotent
- verified payment success can recover from a failed internal application by replaying the exact provider event
- both payer and beneficiary reconciliation returned `healthy: true`, `issueCount: 0` after the final Booking and Order refund gates

## Phase 13 finalization migrations
Pending runtime application/verification:
- `20260914134000_phase13_payout_subject_type`
- `20260914134100_phase13_payout_ledger_backfill`

Purpose:
- add `PAYOUT` to `FinancialSubjectType`
- backfill historical payout ledger rows from `ORDER / PAYOUT:<id>` to `PAYOUT / <id>`

After migration, run API typecheck/build plus one small payout smoke test and reconciliation. If clean, mark Phase 13 COMPLETE.

## Next MVP phase after closure
Phase 14 — Trust + Reputation.

Goal:
Make trust visible and meaningful through verified identity, completed transactions, reviews, ratings and behavioural trust signals.

Do not begin Phase 14 implementation until the Phase 13 finalization migrations and payout smoke test pass.

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
ChatGPT commits directly to `realxpen/hustle-economy-of-you`. The project owner pulls and performs development-machine runtime validation.

Before pulling:
1. `git status`
2. commit/push intentional local source changes only
3. `git pull --rebase origin main`
4. use Node 22
5. restore generated `apps/web/next-env.d.ts` after builds rather than committing it

Use fresh auth sessions/tokens for financial sandbox validation. Never commit or print provider/webhook secrets.

## Next gate
**Apply the two Phase 13 payout-taxonomy migrations, regenerate Prisma Client, run API typecheck/build, perform one small payout success smoke test, and confirm reconciliation remains healthy. Then Phase 13 can be marked COMPLETE and Phase 14 — Trust + Reputation may open.**
