# Hustle Project State

Updated: 2026-09-15

## Current AED capability
Build

## Current MVP phase
Phase 14 — Trust + Reputation

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14A — Trust Model Foundation is COMPLETE.
Phase 14B — Verified Reviews + Ratings is COMPLETE.
Phase 14C — Profile Reputation is COMPLETE after backend + frontend runtime validation.
Phase 14D — Counterparty Trust + Safety is ACTIVE.

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
- Private counterparty trust is separate from public provider reputation: `HUSTLER → CLIENT` and `SELLER → BUYER` feedback belongs to Phase 14D trust/safety intelligence and must never affect public UserReputation.
- Identity verification, transaction verification, public reputation and private trust/safety signals remain distinct.
- Reports and private trust signals must not trigger punitive action from a single subjective complaint alone; patterns, corroboration and platform evidence matter.

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
- Phase 14B — Verified Reviews + Ratings: COMPLETE
- Phase 14C — Profile Reputation: COMPLETE

## Current transaction boundaries

Booking:
`REQUESTED → PAYMENT_PENDING → verified payment → FUNDED → IN_PROGRESS → COMPLETED → escrow release → Hustler AVAILABLE`

Order:
`PENDING → verified payment + inventory deduction → PAID → PROCESSING → SHIPPED/DELIVERED → COMPLETED → buyer-authorized settlement → seller AVAILABLE`

Money:
`payment confirmation → ledger → escrow/pending → available → payout reservation → provider-confirmed payout`

Public reputation:
`verified transaction → eligible Client/Buyer review → verified immutable Review → atomic provider reputation projection → public profile trust signals`

Private trust/safety:
`transaction/interaction evidence → Hustler/Seller private counterparty feedback + reports → Admin safety intelligence → moderation decisions`

## Canonical Phase 14 knowledge
- `Knowledge/Product/TRUST_AND_REPUTATION.md`
- `Knowledge/Decisions/ADR-0013-verified-transaction-reviews.md`
- `Knowledge/Decisions/ADR-0015-one-way-public-reputation-reviews.md`
- `Knowledge/Decisions/ADR-0016-authoritative-release-state-read.md`
- `Knowledge/Decisions/ADR-0017-verified-review-creation-and-reputation-projection.md`
- `Knowledge/Decisions/ADR-0018-private-counterparty-trust.md`
- `Knowledge/Decisions/ADR-0019-public-provider-trust-summary.md`

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
COMPLETE — runtime validated on 2026-09-15.

Validated:
- `POST /api/v1/reviews`
- server re-validates transaction authority during review creation
- browser cannot submit reviewee, roles, verification or reputation values
- 1–5 integer rating and written review 10–2000 characters
- published Review is immutable in MVP
- Review creation + UserReputation update are one serializable transaction
- duplicate/race protection through DB uniqueness + serializable retry
- given, received, reputation and review-detail read models
- Booking review `CLIENT → HUSTLER` published and verified
- Order review `BUYER → SELLER` published and verified
- provider-side direct review attempt rejected with `403`
- duplicate review attempt rejected with `409`
- refunded transaction review attempt rejected with `409`
- frontend reload shows durable published reviews instead of another form
- exact UserReputation after two 5-star reviews:
  - `ratingSum = 10`
  - `reviewCount = 2`
  - `verifiedReviewCount = 2`
  - `bookingReviewCount = 1`
  - `orderReviewCount = 1`
  - `averageRating = 5`

Phase 14B merge:
- `9bfc740f644e003a8b19a404d007be4733ed65fa`

## Phase 14C — Profile Reputation
COMPLETE — runtime validated on 2026-09-15.

Built and validated:
- public server-authoritative trust-summary contract
- public profile consumes one trust summary instead of recalculating rating data in the browser
- exact public provider reputation from UserReputation
- average rating + verified review count
- service/product review counts
- verified-review trust marker
- public received review cards with verified transaction label
- Service and Product transaction context preserved
- signed-in reviewer given-review history on `/account`
- no Client/Buyer public rating introduced
- private counterparty feedback, reports and moderation data remain excluded from public profile surfaces
- public trust summary works without Authorization

Runtime proof for `xpen`:
- `ratingSum = 10`
- `reviewCount = 2`
- `verifiedReviewCount = 2`
- `bookingReviewCount = 1`
- `orderReviewCount = 1`
- `averageRating = 5`
- `trust.marker = VERIFIED_REVIEWS`
- `trust.hasVerifiedReviews = true`
- public reviews contain exactly one verified Product Order review and one verified Service Booking review
- `/u/xpen` shows 5.0, 2 verified reviews, 1 Service review and 1 Product review
- `/account` shows the two durable reviews given by the Client/Buyer

Phase 14C merge:
- `ac2b8df27a8b364819fb2991af2ae2419575874a`

## Phase 14D — Counterparty Trust + Safety
ACTIVE.

Canonical direction:
- Hustler → Client private feedback
- Seller → Buyer private feedback
- private feedback never affects public provider UserReputation
- would-work-with-again signal
- private experience rating for safety/operations only
- issue categories such as no-show, abusive behaviour, scope manipulation, repeated cancellation, fraud/suspicious behaviour, dispute abuse and communication problems
- private notes visible only to authorized trust/safety/admin surfaces
- reports available to either party and usable even when a transaction did not complete
- blocking
- cancellation/refund/dispute/behavioural signals
- Admin trust/safety intelligence
- patterns/corroboration required before punitive action

### Phase 14D build slices

14D-A — Trust/safety data foundation
- private CounterpartyFeedback entity
- SafetyReport entity
- UserBlock entity
- server-authoritative participant/relationship checks
- feedback and report category enums
- RLS/server-only mutation authority
- SystemEvent observation

14D-B — Counterparty feedback flows
- Hustler feedback on Client after meaningful Booking outcomes
- Seller feedback on Buyer after meaningful Order outcomes
- would-work-with-again
- private rating + issue categories + note
- duplicate feedback protection

14D-C — Reports + blocking
- report another user from profile/transaction/message context
- report reasons + optional evidence context
- block/unblock
- blocking affects messaging/contact surfaces without rewriting historical transactions

14D-D — Admin safety intelligence
- private user safety summary
- complaint/report counts
- cancellation/refund/dispute behavioural signals
- feedback pattern summaries
- evidence-attributed risk indicators
- no automatic punitive action from one subjective signal

Phase 14D gate:
1. provider-side private feedback can be created only for the canonical counterparty
2. private feedback never changes public UserReputation
3. duplicate private feedback for the same reporter/transaction is blocked
4. reports are durable and visible only to authorized parties/admin
5. either party can report serious behaviour even when the transaction does not complete
6. block/unblock is server-authoritative and self-block is impossible
7. private feedback/report content never appears on `/u/:username` public trust summary
8. Admin can explain every displayed safety signal from durable evidence
9. public reputation values remain exactly unchanged after private trust/safety actions

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
**Phase 14D-A — create the private trust/safety data foundation with strict separation from public UserReputation, then runtime-test server-authoritative counterparty eligibility before enabling feedback UI.**