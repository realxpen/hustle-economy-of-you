# Hustle Project State

Updated: 2026-09-15

## Current AED capability
Build

## Current MVP phase
Phase 14 — Trust + Reputation

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14A — Trust Model Foundation is COMPLETE.
Phase 14B — Verified Reviews + Ratings is COMPLETE.
Phase 14C — Profile Reputation is COMPLETE.
Phase 14D — Counterparty Trust + Safety is ACTIVE.

Current active slice: **14D-D — Admin Safety Intelligence**.

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Financial state is server-authoritative.
- Never fake payment, funding, escrow, refunds, wallet credit, payout, delivery or completion.
- Reputation must be downstream of verified transaction evidence; browser/mobile clients cannot manufacture verified reviews.
- Public MVP reputation is one-way: `CLIENT → HUSTLER` for Bookings and `BUYER → SELLER` for Orders.
- Private counterparty trust is separate from public provider reputation: `HUSTLER → CLIENT` and `SELLER → BUYER` feedback never affects public UserReputation.
- Identity verification, transaction verification, public reputation and private trust/safety signals remain distinct.
- Reports and private trust signals must not trigger punitive action from a single subjective complaint alone; patterns, corroboration and authoritative platform evidence matter.
- Admin safety intelligence must explain every surfaced indicator from durable evidence and must not use an opaque automatic risk score.

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
`transaction/interaction evidence → Hustler/Seller private counterparty feedback + reports + blocks → explainable Admin safety intelligence → human moderation decisions`

## Canonical Phase 14 knowledge
- `Knowledge/Product/TRUST_AND_REPUTATION.md`
- `Knowledge/Decisions/ADR-0013-verified-transaction-reviews.md`
- `Knowledge/Decisions/ADR-0015-one-way-public-reputation-reviews.md`
- `Knowledge/Decisions/ADR-0016-authoritative-release-state-read.md`
- `Knowledge/Decisions/ADR-0017-verified-review-creation-and-reputation-projection.md`
- `Knowledge/Decisions/ADR-0018-private-counterparty-trust.md`
- `Knowledge/Decisions/ADR-0019-public-provider-trust-summary.md`
- `Knowledge/Decisions/ADR-0021-profile-conversation-safety-report-context.md`
- `Knowledge/Decisions/ADR-0022-explainable-admin-safety-intelligence.md`

## Phase 14A — Trust Model Foundation
COMPLETE — runtime validated on 2026-09-15.

Validated:
- Review + UserReputation schema and hosted migrations
- participant-scoped review eligibility
- public-review DB role-pair constraint permits only Client→Hustler and Buyer→Seller
- verified transaction and authoritative settlement gates
- refunded/incomplete transactions blocked from public reviews

## Phase 14B — Verified Reviews + Ratings
COMPLETE — runtime validated on 2026-09-15.

Validated:
- server-authoritative immutable verified reviews
- serializable Review + UserReputation mutation
- duplicate/race protection
- given/received/reputation/detail read models
- exact xpen reputation after one Booking and one Order 5-star review:
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

Validated:
- public server-authoritative trust summary
- public Hustler profile reputation + verified review cards
- signed-in given-review history
- no Client/Buyer public rating
- private feedback/reports/moderation excluded from public profile
- unauthenticated public trust-summary read works

Phase 14C merge:
- `ac2b8df27a8b364819fb2991af2ae2419575874a`

## Phase 14D — Counterparty Trust + Safety
ACTIVE.

Canonical direction:
- Hustler → Client private feedback
- Seller → Buyer private feedback
- private feedback never affects public provider UserReputation
- reports may come from Booking, Order, Profile or Conversation context
- block/unblock is server-authoritative and stops new messaging while preserving historical evidence
- Admin trust/safety intelligence combines subjective signals and objective platform evidence without conflating them
- patterns/corroboration required before punitive action

### 14D-A — Trust/safety data foundation
COMPLETE — runtime validated on 2026-09-15.

Validated:
- CounterpartyFeedback, SafetyReport and UserBlock durability
- canonical counterparty authority
- terminal-state feedback eligibility
- duplicate feedback protection
- unfinished-transaction reporting
- self-block protection
- public UserReputation unchanged

### 14D-B — Private counterparty feedback UI
COMPLETE — runtime validated on 2026-09-15.

Validated:
- completed Booking already-submitted persistence
- pending Booking locked state
- Seller → Buyer Order feedback form
- Client/Buyer does not receive reciprocal public/private provider form
- public UserReputation unchanged

### 14D-C — Reports + blocking
COMPLETE — runtime validated on 2026-09-15.

Validated C1:
- transaction report UI + durable reports
- block/unblock UI
- blocked users cannot start direct conversations
- blocked users cannot send new messages
- historical messages remain readable
- unblock restores messaging
- public UserReputation unchanged

Validated C2:
- PROFILE report created with server-derived target
- self-profile report rejected with HTTP 400
- CONVERSATION report created with server-derived other participant
- durable report history contains BOOKING, ORDER, PROFILE and CONVERSATION contexts
- public xpen reputation remains exactly 10 / 2 / 5.0 after all safety reports

Phase 14D-C2 merge:
- `50953872e93b2bff4da98c98df64e43e8543286b`

### 14D-D — Admin safety intelligence
IMPLEMENTED — CI/runtime validation pending.

Built:
- authenticated + explicit admin-allowlist boundary through `HUSTLE_ADMIN_USER_IDS`
- `GET /api/v1/admin/trust-safety/overview`
- `GET /api/v1/admin/trust-safety/reports`
- `GET /api/v1/admin/trust-safety/users/:userId/summary`
- `PATCH /api/v1/admin/trust-safety/reports/:reportId`
- private user safety summaries combining reports, private feedback, blocks and authoritative transaction outcomes
- distinct subjective vs platform evidence
- explainable indicators with evidence payloads instead of an opaque score
- serious single allegations surface for human review but do not automatically penalize the user
- report moderation states: OPEN, UNDER_REVIEW, ACTIONED, DISMISSED
- moderation notes required for ACTIONED/DISMISSED outcomes
- SystemEvent audit trail for admin report-state changes
- internal Admin Trust & Safety console on port 3002
- internal console keeps the bearer token in browser sessionStorage only and API authorization remains server-enforced

14D-D runtime gate:
1. non-admin authenticated user receives HTTP 403 from admin safety endpoints
2. allowlisted admin can read overview and report queue
3. xpen summary exposes the four durable report contexts and private transaction-backed feedback
4. displayed indicators contain human-readable explanation + exact evidence values
5. one subjective report does not create punitive state or alter public UserReputation
6. report can move OPEN → UNDER_REVIEW
7. ACTIONED/DISMISSED requires a moderation note
8. admin report-state change emits durable audit event
9. Admin UI loads queue and user evidence from the same server contracts
10. public xpen reputation remains exactly `ratingSum 10 / reviewCount 2 / averageRating 5`

## Supabase
Dedicated project:
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`

Auth/database/storage remain hosted in the dedicated Hustle project.

## Local development
- Web: `http://localhost:3001`
- API: `http://localhost:4000/api/v1`
- Admin: `http://localhost:3002`
- Node: 22.x via `.nvmrc`

Secrets and `.env` files remain local and must never be committed.
`HUSTLE_ADMIN_USER_IDS` is a server-only comma-separated allowlist of canonical Hustle User IDs permitted to access internal Admin APIs during the MVP bootstrap stage.

## Repository workflow
ChatGPT commits directly to `realxpen/hustle-economy-of-you`. The project owner pulls and performs development-machine runtime validation.

Before pulling:
1. `git status`
2. commit/push intentional local source changes only
3. `git pull --rebase origin main`
4. use Node 22
5. restore generated `apps/web/next-env.d.ts` after builds rather than committing it

Use fresh auth sessions/tokens for runtime validation. Never commit or print provider/webhook/admin secrets.

## Next gate
**Phase 14D-D — runtime-validate admin authorization, explainable user safety summaries, moderation transitions, Admin UI, audit evidence, and the unchanged public reputation invariant.**
