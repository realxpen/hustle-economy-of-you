# Hustle Project State

Updated: 2026-09-14

## Current AED capability
Build

## Current MVP phase
Phase 14 — Trust + Reputation

Phase 13 — Payments + Escrow is COMPLETE. All implementation, migration, runtime, idempotency, refund, payout, inventory-restoration, ledger-taxonomy and reconciliation gates passed on 2026-09-14.

Phase 14A — Trust Model Foundation is IMPLEMENTED in code and awaiting local migration/runtime validation before Phase 14B begins.

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Financial state is server-authoritative.
- Never fake payment, funding, escrow, refunds, wallet credit, payout, delivery or completion.
- Browser/mobile clients may request financial operations, but verified provider/internal durable evidence determines success.
- Reputation must be downstream of verified transaction evidence; browser/mobile clients cannot manufacture verified reviews.
- Identity verification, transaction verification and reputation are distinct trust signals.

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

Trust:
`verified transaction → review eligibility → verified review → reputation projection → profile trust signals`

## Canonical Phase 13 knowledge
- `Knowledge/Product/PAYMENTS_AND_ESCROW.md`
- `Knowledge/Decisions/ADR-0012-payment-authority-ledger-and-escrow.md`
- `Knowledge/Technical/PAYMENT_SANDBOX_FOUNDATION.md`
- `Knowledge/Technical/WALLET_ESCROW_SETTLEMENT.md`
- `Knowledge/Technical/PAYOUT_REFUND_RECONCILIATION.md`
- `Knowledge/Technical/FINANCIAL_WEB_EXPERIENCE.md`

## Phase 13 — Payments + Escrow
COMPLETE — 2026-09-14.

Validated:
- Booking authoritative payment → escrow HELD → FUNDED
- Booking completion + escrow release → AVAILABLE
- Product Order authoritative payment + inventory deduction
- Order fulfillment + settlement
- successful payout
- payout failure + wallet restoration
- Booking refund + escrow compensation
- Order refund + exact inventory restoration
- duplicate payment/refund/payout webhooks are idempotent
- recoverable payment domain application after Prisma interactive-transaction timeout fix
- payout ledger taxonomy uses `FinancialSubjectType.PAYOUT`
- historical payout rows backfilled from temporary `ORDER / PAYOUT:<id>` representation
- final payer + beneficiary reconciliation both healthy

Production payment activation remains a separate human risk gate.

## Canonical Phase 14 knowledge
- `Knowledge/Product/TRUST_AND_REPUTATION.md`
- `Knowledge/Decisions/ADR-0013-verified-transaction-reviews.md`

## Phase 14A — Trust Model Foundation
IMPLEMENTED; migration/runtime gate pending.

Built:
- `ReviewSubjectType`: BOOKING / ORDER
- `ReviewPartyRole`: CLIENT / HUSTLER / BUYER / SELLER
- `ReviewStatus`: PUBLISHED / HIDDEN / REMOVED
- durable `Review` model
- rebuildable `UserReputation` projection
- DB constraints for rating range, review body length, no self-review, valid role pairs and one review per reviewer per transaction
- RLS + API-role access for trust tables
- authenticated participant-scoped review eligibility endpoint
- server-derived reviewee identity and reviewer/reviewee roles
- verified transaction requirement

Eligibility API:
- `GET /api/v1/reviews/eligibility/:subjectType/:subjectId`

Booking review eligibility requires:
- requester is Client or Hustler
- Booking `COMPLETED` or `CLOSED`
- `completedAt` exists
- successful authoritative applied payment
- escrow `RELEASED` + `releasedAt`
- not refunded
- not disputed
- no prior review by that reviewer
- no self-review

Order review eligibility requires:
- requester is Buyer or Seller
- Order `COMPLETED`
- `completedAt` exists
- successful authoritative applied payment
- not refunded
- no prior review by that reviewer
- no self-review

Review policy locked for MVP:
- one overall rating, integer 1–5
- written review 10–2000 characters
- no arbitrary reviewee ID from client
- published review is immutable
- author hard-delete is not exposed
- moderation later uses PUBLISHED / HIDDEN / REMOVED while retaining durable review evidence
- refunded/disputed/cancelled/unpaid/incomplete transactions do not enter verified reputation
- average rating will be derived from exact `ratingSum / reviewCount`, not stored as mutable floating-point authority

Migration:
- `20260914160000_phase14a_trust_foundation`

## Phase 14B — Review Creation + Read Models
PENDING until Phase 14A runtime gate passes.

Planned next:
- create verified review from eligibility proof
- transactional `UserReputation` update
- received/given review lists
- public review read model
- duplicate/race handling
- SystemEvent observations for review creation

## Phase 14A runtime gate
Before Phase 14B begins:
1. pull current main after Phase 14A merge
2. `prisma migrate deploy`
3. `prisma generate`
4. API typecheck/build
5. completed released Booking returns `ELIGIBLE` for both participants
6. completed paid Order returns `ELIGIBLE` for both participants
7. refunded/disputed/incomplete subject returns ineligible
8. non-participant access is forbidden
9. schema constraints and RLS exist in hosted database

Do not begin review creation or reputation ranking effects until this gate passes.

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
**Phase 14A — deploy the trust migration, regenerate Prisma Client, typecheck/build the API, then runtime-test review eligibility against completed/refunded/incomplete Booking and Order subjects. If clean, open Phase 14B — Review Creation + Read Models.**
