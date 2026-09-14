# Hustle Project State

Updated: 2026-09-14

## Current AED capability
Build

## Current MVP phase
Phase 14 — Trust + Reputation

Phase 13 — Payments + Escrow is COMPLETE. All implementation, migration, runtime, idempotency, refund, payout, inventory-restoration, ledger-taxonomy and reconciliation gates passed on 2026-09-14.

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
- Phase 11 — Booking System: COMPLETE
- Phase 12 — Cart + Orders: COMPLETE
- Phase 13 — Payments + Escrow: COMPLETE

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

## Phase 13 — Completion evidence

### 13A — Financial data foundation
COMPLETE.

Financial records:
- `PaymentAttempt`
- `LedgerAccount`
- `LedgerTransaction`
- `LedgerPosting`
- `EscrowRecord`
- `Payout`
- `Refund`
- `WebhookEvent`

Hosted financial migrations are applied. The existing production-like Supabase schema was safely baselined into Prisma migration history without resetting data.

Final payout-taxonomy migrations applied successfully:
- `20260914134000_phase13_payout_subject_type`
- `20260914134100_phase13_payout_ledger_backfill`

Payout ledger records now use `FinancialSubjectType.PAYOUT` with the durable payout ID as `subjectId`; historical sandbox payout rows were backfilled from the temporary `ORDER / PAYOUT:<id>` representation.

### 13B — Payment gateway foundation
COMPLETE; RUNTIME VALIDATED.

Validated:
- provider-neutral collection port
- HUSTLE_SANDBOX payment adapter
- required initialization idempotency
- server-derived payer, beneficiary, amount and currency
- HMAC-SHA256 webhook verification
- duplicate provider-event protection
- exact reference/amount/currency validation
- Booking `PAYMENT_PENDING → FUNDED`
- Order `PENDING → PAID` with inventory revalidation/deduction
- balanced payment-capture ledger postings
- Service escrow `HELD`
- Product seller `PENDING` proceeds
- recoverable domain application through `domainAppliedAt`

Runtime defect discovered and fixed:
- a verified `payment.succeeded` could reach `SUCCEEDED` while internal domain application failed because Prisma's default interactive-transaction timeout was too short for the multi-write payment-capture path
- payment capture now uses explicit `maxWait: 10_000` and `timeout: 30_000`
- replaying the exact same verified event completed domain application without a second charge

### 13C — Escrow + Wallet
COMPLETE; RUNTIME VALIDATED.

Validated:
- ledger-derived AVAILABLE / PENDING / ESCROW / PAYOUT_RESERVED buckets
- Booking escrow HELD → RELEASED with ESCROW debit → AVAILABLE credit
- Product settlement PENDING → AVAILABLE after completed Order
- idempotent release keys
- wallet transaction history
- `/wallet` web surface

### 13D — Payout + Refund + Reconciliation
COMPLETE; RUNTIME VALIDATED.

Validated:
- atomic withdrawal reservation AVAILABLE → PAYOUT_RESERVED
- signed provider payout success/failure
- successful payout removes reserved funds to provider clearing
- failed payout restores reserved funds to AVAILABLE exactly once
- Booking authoritative refund with escrow compensation
- Order authoritative refund with inventory restoration exactly once
- compensating refund ledger postings
- stale/duplicate operation event handling
- reconciliation for unapplied payments, pending operations, failed webhooks, negative balances and unbalanced ledger transactions
- payout ledger subject taxonomy uses `PAYOUT`

### 13E — Financial web experience
COMPLETE.

Web:
- `/wallet` balances, history, withdrawals, refund status and reconciliation health
- Account → Wallet navigation
- Booking detail financial controls
- Order detail financial controls
- payment initialization/status/retry
- refund request controls
- Booking escrow release control
- Order settlement release control
- session-scoped idempotency keys
- durable latest-payment recovery after refresh

The web experience contains no control that directly declares provider success.

### 13F — Sandbox money gate
PASSED — 2026-09-14.

Service path validated:
`PAYMENT_PENDING → signed payment success → PaymentAttempt SUCCEEDED → escrow HELD → Booking FUNDED → work → COMPLETED → escrow RELEASED → AVAILABLE → payout reserve → signed payout success`

Product path validated:
`PENDING Order → signed payment success → inventory deduction → PAID → fulfillment → COMPLETED → seller PENDING → AVAILABLE → payout`

Refund validation:
- Booking refund moved `FUNDED → REFUNDED`, removed held escrow, and duplicate webhook made no second compensation
- Order tracked stock moved `4 → 3` on authoritative payment and `3 → 4` on authoritative refund; duplicate refund webhook left stock at `4`

Payout validation:
- payout success completed and exact-event replay was idempotent
- payout failure restored reserved funds to AVAILABLE exactly once
- final post-migration payout wrote `PAYOUT_RESERVED` and `PAYOUT_SENT` rows with `subjectType=PAYOUT` and the payout UUID as `subjectId`

Final reconciliation:
- payer: `healthy: true`, `issueCount: 0`
- Hustler/beneficiary: `healthy: true`, `issueCount: 0`

## Production payment gate
Phase 13 completion does not activate production money movement.

Production provider keys, production webhook routing, payout destinations, monitoring, reconciliation operations and human risk approval remain a separate activation gate.

## Phase 14 — Trust + Reputation
OPEN.

Goal:
Make trust visible and meaningful through verified identity, completed transactions, reviews, ratings and behavioural trust signals.

Core loop:
`Verified transaction → review eligibility → rating/review → trust signals → stronger reputation → better discovery/opportunity`

Phase 14 must build on real transaction truth from Phases 11–13. Reviews or reputation signals must not be manufactured from unverified interactions.

Initial Phase 14 scope to define before implementation:
- review eligibility rules for completed Bookings and Orders
- one-review-per-eligible-transaction idempotency
- rating dimensions / aggregate rating model
- written reviews and optional media/proof rules
- review authorship and subject relationships
- received vs given reviews
- verified-transaction badge semantics
- profile trust/reputation summary
- dispute/refund interaction with review eligibility
- anti-spam / self-review / duplicate-review protections
- moderation/reporting boundaries
- reputation signals available to discovery/ranking later

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
**Phase 14A — define the Trust + Reputation canonical product model, review eligibility rules, database entities and server-authority boundaries before implementation.**
