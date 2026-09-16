# Hustle Project State

Updated: 2026-09-16

## Current AED capability
Build

## Current MVP phase
Phase 14 — Trust + Reputation

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14A — Trust Model Foundation is COMPLETE.
Phase 14B — Verified Reviews + Ratings is COMPLETE.
Phase 14C — Profile Reputation is COMPLETE.
Phase 14D — Counterparty Trust + Safety is COMPLETE.

Current active slice: **14E — Full Trust Experience + final trust runtime gate**.

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Financial state is server-authoritative.
- Never fake payment, funding, escrow, refunds, wallet credit, payout, delivery or completion.
- Reputation is downstream of verified transaction evidence; clients cannot manufacture verified reviews.
- Public MVP reputation is one-way: `CLIENT → HUSTLER` for Bookings and `BUYER → SELLER` for Orders.
- Private counterparty trust is separate: `HUSTLER → CLIENT` and `SELLER → BUYER` feedback never affects public UserReputation.
- Identity verification, transaction verification, public reputation and private trust/safety signals remain distinct.
- A single subjective complaint must never trigger automatic punitive action.
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
- Phase 14D — Counterparty Trust + Safety: COMPLETE

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
`interaction/transaction evidence → private counterparty feedback + reports + blocks → explainable Admin intelligence → human moderation`

## Canonical Phase 14 knowledge
- `Knowledge/Product/TRUST_AND_REPUTATION.md`
- `Knowledge/Decisions/ADR-0013-verified-transaction-reviews.md`
- `Knowledge/Decisions/ADR-0015-one-way-public-reputation-reviews.md`
- `Knowledge/Decisions/ADR-0016-authoritative-release-state-read.md`
- `Knowledge/Decisions/ADR-0017-verified-review-creation-and-reputation-projection.md`
- `Knowledge/Decisions/ADR-0018-private-counterparty-trust.md`
- `Knowledge/Decisions/ADR-0019-public-provider-trust-summary.md`
- `Knowledge/Decisions/ADR-0020-counterparty-trust-safety-foundation.md`
- `Knowledge/Decisions/ADR-0021-profile-conversation-safety-report-context.md`
- `Knowledge/Decisions/ADR-0022-explainable-admin-safety-intelligence.md`

## Phase 14A — Trust Model Foundation
COMPLETE — runtime validated 2026-09-15.

Validated:
- Review + UserReputation schema and migrations
- participant-scoped review eligibility
- public-review role pair constrained to Client→Hustler and Buyer→Seller
- verified transaction and authoritative settlement gates
- refunded/incomplete transactions blocked from public reviews
- public reputation remained server-authoritative

## Phase 14B — Verified Reviews + Ratings
COMPLETE — runtime validated 2026-09-15.

Validated:
- immutable verified public reviews
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
COMPLETE — runtime validated 2026-09-15.

Validated:
- public server-authoritative trust summary
- public Hustler reputation + verified review cards
- signed-in given-review history
- no Client/Buyer public rating
- private feedback/reports/moderation excluded from public profile
- unauthenticated public trust-summary read

Phase 14C merge:
- `ac2b8df27a8b364819fb2991af2ae2419575874a`

## Phase 14D — Counterparty Trust + Safety
COMPLETE — runtime validated 2026-09-16.

Canonical direction:
- Hustler → Client private feedback
- Seller → Buyer private feedback
- private feedback never affects public provider UserReputation
- reports support BOOKING, ORDER, PROFILE and CONVERSATION contexts
- report targets are server-derived
- block/unblock is server-authoritative
- blocking prevents new direct contact while preserving historical evidence
- Admin intelligence separates subjective signals from authoritative platform evidence
- human review is required for moderation outcomes

### 14D-A — Trust/safety data foundation
COMPLETE — runtime validated 2026-09-15.

Validated:
- CounterpartyFeedback, SafetyReport and UserBlock durability
- canonical counterparty authority
- terminal-state private-feedback eligibility
- duplicate feedback protection
- unfinished-transaction reporting
- self-block protection
- public UserReputation unchanged

### 14D-B — Private counterparty feedback
COMPLETE — runtime validated 2026-09-15.

Validated:
- Hustler → Client Booking feedback
- Seller → Buyer Order feedback
- would-work-again signal
- optional private rating/issues/note
- provider-only feedback authority
- submitted/locked frontend states
- public UserReputation unchanged

Phase 14D-B merge:
- `2458789ff4ad8c7660c5c5849c827a30fb695560`

### 14D-C — Reports + blocking
COMPLETE — runtime validated 2026-09-15.

Validated C1:
- transaction report UI + durable reports
- block/unblock UI
- blocked users cannot create direct conversations
- blocked users cannot send new messages
- historical messages remain readable
- unblock restores messaging
- public UserReputation unchanged

Validated C2:
- PROFILE report with server-derived target
- self-profile report rejected with HTTP 400
- CONVERSATION report with server-derived other participant
- durable report history contains BOOKING, ORDER, PROFILE and CONVERSATION
- public xpen reputation remained exactly 10 / 2 / 5.0

Phase 14D-C1 merge:
- `9e0bfdd441db9dd49d6e64b59a71f6c73ca60f4c`

Phase 14D-C2 merge:
- `50953872e93b2bff4da98c98df64e43e8543286b`

### 14D-D — Admin Safety Intelligence
COMPLETE — CI + runtime validated 2026-09-16.

Built and validated:
- AuthGuard + server-only `HUSTLE_ADMIN_USER_IDS` allowlist
- non-admin `xpen` receives HTTP 403 from Admin safety endpoints
- allowlisted `adminxpen` receives HTTP 200
- Admin overview exposes report counts, private-feedback count, active blocks and users needing review
- xpen Admin summary exposes 4 report contexts with `uniqueReporters = 1`
- xpen summary separates reports, private feedback and authoritative platform evidence
- xpen safety policy returns `automaticPunitiveAction = false`
- explainable `SERIOUS_UNRESOLVED_REPORT` and transaction-outcome indicators contain exact evidence values
- adminxpen summary exposes two private counterparty feedback records: one Booking HUSTLER→CLIENT and one Order SELLER→BUYER
- moderation transition `OPEN/UNDER_REVIEW` works
- `ACTIONED` without moderation note returns HTTP 400
- synthetic Profile report successfully transitioned to `DISMISSED` with durable reviewed/resolved timestamps
- hosted `SystemEvent` audit proof exists for both `UNDER_REVIEW` and `DISMISSED` transitions under event name `safety.admin_report_status_changed`
- internal Trust & Safety Admin console loads and operates successfully on port 3003
- local Admin CORS for port 3003 validated
- public xpen reputation remains exactly:
  - `ratingSum = 10`
  - `reviewCount = 2`
  - `verifiedReviewCount = 2`
  - `bookingReviewCount = 1`
  - `orderReviewCount = 1`
  - `averageRating = 5`

Phase 14D-D merge:
- `077042743e4cc949dc235d6c7527a5c269ae0be8`

Admin port migration:
- Admin moved from port 3002 to 3003: `9b9d347e3a2c117976bbf4586690cf0afc0e5166`
- local Admin CORS fix: `00d9ef8c47dff35faae2a406baef93b0d75d49fc`

## Phase 14E — Full Trust Experience + final trust runtime gate
ACTIVE.

Goal:
- validate the complete public + private trust experience as one coherent product flow
- remove remaining trust/safety UX inconsistencies
- verify all public/private/admin boundaries together
- finish Phase 14 with one final end-to-end gate before moving deeper into the next MVP capability area

Planned final gate:
1. public provider trust summary remains verified-transaction-only
2. Client/Buyer can create eligible public provider reviews only once
3. Hustler/Seller can create private counterparty feedback only for canonical counterparties
4. report contexts work from transaction, profile and conversation surfaces
5. blocking prevents new contact without erasing historical evidence
6. Admin intelligence remains private and explainable
7. no private signal changes public UserReputation
8. trust/safety UI states are consistent across web surfaces
9. final xpen public reputation regression remains 10 / 2 / 5.0

## Supabase
Dedicated project:
- Ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`

Auth/database/storage remain hosted in the dedicated Hustle project.

## Local development
- Web: `http://localhost:3001`
- Admin: `http://localhost:3003`
- API: `http://localhost:4000/api/v1`
- Node: 22.x via `.nvmrc`

Secrets and `.env` files remain local and must never be committed.
`HUSTLE_ADMIN_USER_IDS` is a server-only comma-separated allowlist of canonical Hustle User IDs permitted to access internal Admin APIs during the MVP bootstrap stage.

In non-production local development, the canonical Hustle origins are:
- `http://localhost:3001`
- `http://localhost:3003`

Production CORS remains configuration-driven.

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
**Phase 14E — run the complete Trust Experience audit, fix remaining trust UX inconsistencies, then execute the final end-to-end public/private/admin trust runtime gate.**
