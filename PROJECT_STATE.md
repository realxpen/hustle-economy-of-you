# Hustle Project State

Updated: 2026-09-15

## Current AED capability
Build

## Current MVP phase
Phase 14 — Trust + Reputation

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14A — Trust Model Foundation is COMPLETE after backend + frontend runtime validation and authority corrections.
Phase 14B — Verified Reviews + Ratings is IMPLEMENTED and awaiting local runtime validation before Phase 14C begins.

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
- Public MVP reputation is one-way: `CLIENT → HUSTLER` for Bookings and `BUYER → SELLER` for Orders.
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
- Phase 14A — Trust Model Foundation: COMPLETE

## Current transaction boundaries

Booking:
`REQUESTED → PAYMENT_PENDING → verified payment → FUNDED → IN_PROGRESS → COMPLETED → escrow release → Hustler AVAILABLE`

Order:
`PENDING → verified payment + inventory deduction → PAID → PROCESSING → SHIPPED/DELIVERED → COMPLETED → buyer-authorized settlement → seller AVAILABLE`

Money:
`payment confirmation → ledger → escrow/pending → available → payout reservation → provider-confirmed payout`

Trust:
`verified transaction → eligible Client/Buyer review → verified immutable Review → atomic provider reputation projection → profile trust signals`

## Canonical Phase 14 knowledge
- `Knowledge/Product/TRUST_AND_REPUTATION.md`
- `Knowledge/Decisions/ADR-0013-verified-transaction-reviews.md`
- `Knowledge/Decisions/ADR-0015-one-way-public-reputation-reviews.md`
- `Knowledge/Decisions/ADR-0016-authoritative-release-state-read.md`
- `Knowledge/Decisions/ADR-0017-verified-review-creation-and-reputation-projection.md`

## Phase 14A — Trust Model Foundation
COMPLETE — runtime validated on 2026-09-15.

Validated:
- Review + UserReputation schema and hosted migrations
- participant-scoped review eligibility
- completed released Booking: Client eligible
- Booking Hustler: public-review role ineligible and no public review UI
- completed paid Order: Buyer eligible
- Order Seller: public-review role ineligible and no public review UI
- refunded/incomplete/cancelled transactions blocked
- review verification is server-derived only
- public-review DB role-pair constraint permits only Client→Hustler and Buyer→Seller
- Booking/Order release actions follow authoritative financial state after refresh
- seller cannot release own Order settlement
- empty latest-payment responses no longer produce JSON parse errors

## Phase 14B — Verified Reviews + Ratings
IMPLEMENTED; runtime gate pending.

Built:
- `POST /api/v1/reviews`
- server re-validates transaction authority during review creation
- browser cannot submit reviewee, roles, verification or reputation values
- 1–5 integer rating
- written review 10–2000 characters
- published Review is immutable in MVP
- Review creation + UserReputation projection update are one serializable transaction
- exact duplicate/race protection through DB uniqueness + one serializable retry
- `review.published` SystemEvent observation
- `GET /api/v1/reviews/me/given`
- `GET /api/v1/reviews/users/:userId/received`
- `GET /api/v1/reviews/users/:userId/reputation`
- `GET /api/v1/reviews/:reviewId`
- read models include verified transaction metadata and Service/Product transaction context
- web Booking/Order review form with accessible 1–5 stars and written review
- after submission the form is replaced immediately by the published immutable review
- reload resolves the existing review and does not offer a duplicate form

CI validation passed before merge:
- web typecheck
- admin typecheck
- mobile typecheck
- Prisma generate
- API typecheck
- web build
- admin build
- API build

Phase 14B merge:
- `9bfc740f644e003a8b19a404d007be4733ed65fa`

No new Phase 14B schema migration is required; Phase 14A already created Review/UserReputation and DB constraints.

## Phase 14B runtime gate
Before Phase 14C begins:
1. pull current `main`
2. restart API + web
3. Client submits one Booking review from the completed/released Booking
4. verify returned Review is `PUBLISHED`, verified, `CLIENT → HUSTLER`, and target is server-derived
5. verify Hustler UserReputation increments exactly once
6. reload Booking page and confirm published review renders instead of another form
7. duplicate submission returns conflict and does not change reputation
8. invalid rating/body are rejected
9. refunded/incomplete Booking review creation is rejected server-side
10. Buyer submits one completed Order review
11. verify `BUYER → SELLER`, published/verified Review and exact reputation increment
12. Seller/Hustler direct POST attempt is rejected
13. given/received/reputation read endpoints match durable Review rows

## Next phase after gate
Phase 14C — Profile Reputation:
- average rating + review count surfaces
- verified review badge
- provider received-review profile tab
- reviewer given-review history
- Service/Product context in review cards
- trust summary for search/discovery consumption

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

Use fresh auth sessions/tokens for runtime validation. Never commit or print provider/webhook secrets.

## Next gate
**Phase 14B runtime validation — create real Booking and Order reviews from the web/API, prove duplicate/invalid/provider-side attempts fail safely, and confirm UserReputation increments exactly once.**
