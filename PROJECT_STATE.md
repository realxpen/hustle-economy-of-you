# Hustle Project State

Updated: 2026-09-16

## Current AED capability
Build

## Current MVP phase
Phase 15 — Public Hustle Storefront Website

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14 — Trust + Reputation is COMPLETE.

Current active slice: **Phase 15 — Public Hustle Storefront Website**.

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
- Private counterparty trust is separate: `HUSTLER → CLIENT` and `SELLER → BUYER` feedback never affects public `UserReputation`.
- Identity verification, transaction verification, public reputation and private trust/safety signals remain distinct.
- A single subjective complaint must never trigger automatic punitive action.
- Admin safety intelligence must be explainable and evidence-backed rather than an opaque risk score.

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
- Phase 14 — Trust + Reputation: COMPLETE

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

## Phase 14 — Trust + Reputation
COMPLETE — final end-to-end runtime validated 2026-09-16.

### 14A — Trust Model Foundation
COMPLETE.

Validated:
- Review + `UserReputation` schema and migrations
- participant-scoped eligibility
- Client→Hustler and Buyer→Seller public-review authority only
- verified transaction and authoritative settlement gates
- refunded/incomplete transactions blocked from public review

### 14B — Verified Reviews + Ratings
COMPLETE.

Validated:
- immutable verified public reviews
- duplicate/race protection
- atomic reputation projection
- given/received/reputation/detail read models

### 14C — Profile Reputation
COMPLETE.

Validated:
- public server-authoritative trust summary
- Hustler reputation and verified review cards
- signed-in given-review history
- no public Client/Buyer rating
- private trust/safety data excluded from public profile

### 14D — Counterparty Trust + Safety
COMPLETE.

Validated:
- Hustler→Client and Seller→Buyer private feedback
- transaction-backed feedback authority
- reports from BOOKING, ORDER, PROFILE and CONVERSATION contexts
- server-derived report targets
- block/unblock authority
- blocking prevents new direct contact while preserving historical evidence
- Admin allowlist and private moderation console
- subjective reports separated from authoritative platform evidence
- explainable indicators only
- moderation notes required for ACTIONED/DISMISSED
- durable `safety.admin_report_status_changed` audit events
- Admin console operational on port 3003

### 14E — Full Trust Experience
COMPLETE — CI + end-to-end runtime validated 2026-09-16.

Built and validated:
- unified signed-in Trust Activity center on `/account`
- separate Public reviews / Private feedback / Reports / Blocked users surfaces
- explicit PUBLIC / PRIVATE / ADMIN ONLY trust boundaries
- `adminxpen` sees 2 public reviews, 0 authored private feedback, 4 durable reports, and block state
- `xpen` sees the 2 private feedback records they authored
- report moderation statuses display in the signed-in account surface
- block → Trust Activity → unblock loop works and restores contact
- historical messages, transactions, reviews and reports survive block/unblock
- private notes remain private to the author/Admin path and do not leak publicly
- private feedback stars are cumulative
- private feedback issue selection is capped at the backend-supported maximum of 8
- Admin intelligence remains private and explainable
- public xpen reputation remains unchanged at the final regression gate:
  - `ratingSum = 10`
  - `reviewCount = 2`
  - `verifiedReviewCount = 2`
  - `bookingReviewCount = 1`
  - `orderReviewCount = 1`
  - `averageRating = 5`

Phase 14E merge:
- `530d3505ed5ddee18b8f1576f01cf3ad697e774d`

Canonical Phase 14 knowledge:
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
- `Knowledge/Decisions/ADR-0023-full-trust-experience.md`

## Phase 15 — Public Hustle Storefront Website
ACTIVE.

Canonical goal:
Give every Hustler an automatically generated, shareable public web presence from existing Hustle data. This is not a drag-and-drop website builder in the MVP.

Canonical public route direction:
`/u/:username` remains the Hustler identity route and should evolve into the full public storefront experience rather than creating a disconnected second identity.

Storefront should assemble from:
- professional profile
- portfolio / capability proof
- services
- products
- posts / featured work
- verified public reviews and reputation
- contact / message / book / buy actions

Distribution requirements:
- direct public URL
- share to WhatsApp
- share to Instagram/X through normal platform share flows where supported
- copy link
- QR code
- signed-out visitors can understand the Hustler and browse public offers without a Hustle session

Phase 15 gate:
1. a signed-out visitor can open a Hustler storefront by username;
2. profile identity, capability proof, services, products, content and verified reputation are composed coherently;
3. private trust/safety information never appears;
4. Book/Buy/Message CTAs route correctly and authentication is requested only when an action requires it;
5. storefront has useful social/share metadata and a copy/share path;
6. a QR code can represent the canonical storefront URL;
7. storefront remains generated from authoritative Hustle data, not duplicated manually;
8. `xpen` storefront can be used as the runtime reference profile.

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

In non-production local development, canonical Hustle origins are:
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
**Phase 15 — build the public Hustle storefront from the existing `/u/:username` identity surface, preserving one identity and composing profile, proof, offers, content, verified reputation and distribution into one signed-out-friendly page.**
