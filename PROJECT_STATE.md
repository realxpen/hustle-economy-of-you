# Hustle Project State

Updated: 2026-09-17

## Current AED capability
Build

## Current MVP phase
Phase 17 — Live Commerce Beta

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14 — Trust + Reputation is COMPLETE.
Phase 15 — Public Hustle Storefront Website is COMPLETE.
Phase 16 — Stories + Universal User Content is COMPLETE — implementation, CI and runtime validated 2026-09-17.

Current active slice: **Phase 17A — Live Commerce Foundation — IMPLEMENTED + CI GREEN; runtime migration/validation pending.**

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- Posts and Stories are User-level content capabilities. Every authenticated Client or Hustler can publish.
- HUSTLER is required for owning/selling professional Services and Products, not for having a public voice.
- Client-authored Posts/Stories may `@mention` users and reference any currently published Service/Product, including another Hustler's.
- Referencing another Hustler's Service/Product never transfers merchant ownership and never implies the content author owns the offer.
- Social recommendations, opinions and review-style Posts/Stories are community content and never manufacture verified reputation.
- Verified public reputation remains downstream of eligible transaction evidence and a canonical Review record.
- Story views, reactions and private replies are social/observation signals only and never affect verified `UserReputation`.
- Private Story replies must respect the existing UserBlock policy and never become a public comment surface.
- Live viewing is public; Live commenting is authenticated; commerce Live hosting requires ACTIVE HUSTLER + PUBLISHED ProfessionalProfile.
- A Live host may pin only their own currently PUBLISHED Service or Product, one offer at a time.
- Live references canonical Service/Product entities and never creates separate price, inventory, Booking, Order, payment or reputation authority.
- Live presence/comments/conversion events are social or observation signals only and never affect verified `UserReputation`.
- Live comments must respect existing UserBlock direct-contact policy.
- Native Live broadcasting must never be claimed before real media transport is integrated and runtime validated.
- Financial state is server-authoritative.
- Never fake payment, funding, escrow, refunds, wallet credit, payout, delivery or completion.
- Public MVP reputation is one-way: `CLIENT → HUSTLER` for Bookings and `BUYER → SELLER` for Orders.
- Private counterparty trust is separate: `HUSTLER → CLIENT` and `SELLER → BUYER` feedback never affects public `UserReputation`.
- Identity verification, transaction verification, public reputation and private trust/safety signals remain distinct.
- A single subjective complaint must never trigger automatic punitive action.
- Admin safety intelligence must be explainable and evidence-backed rather than an opaque risk score.
- Public Hustler storefronts are generated from the same Hustle identity and authoritative published professional data; there is no second website-builder identity.

## Completed MVP phases
- Phase 1 — Technical Foundation: COMPLETE
- Phase 2 — Authentication + Unified Account: COMPLETE
- Phase 3 — Hustler Application: COMPLETE
- Phase 4 — Professional Profile: COMPLETE
- Phase 5 — Services: COMPLETE
- Phase 6 — Products: COMPLETE
- Phase 7 — Content Creation Engine: COMPLETE, authority amended to universal User content in Phase 16
- Phase 8 — Home Discovery Feed: COMPLETE, authority amended to discover Client + Hustler posts in Phase 16
- Phase 9 — Search + Marketplace: COMPLETE
- Phase 10 — Messaging: COMPLETE
- Phase 11 — Booking System: COMPLETE
- Phase 12 — Cart + Orders: COMPLETE
- Phase 13 — Payments + Escrow: COMPLETE
- Phase 14 — Trust + Reputation: COMPLETE
- Phase 15 — Public Hustle Storefront Website: COMPLETE
- Phase 16 — Stories + Universal User Content: COMPLETE

## Current transaction and trust boundaries

Booking:
`REQUESTED → PAYMENT_PENDING → verified payment → FUNDED → IN_PROGRESS → COMPLETED → escrow release → Hustler AVAILABLE`

Order:
`PENDING → verified payment + inventory deduction → PAID → PROCESSING → SHIPPED/DELIVERED → COMPLETED → buyer-authorized settlement → seller AVAILABLE`

Money:
`payment confirmation → ledger → escrow/pending → available → payout reservation → provider-confirmed payout`

Verified public reputation:
`eligible verified transaction → Client/Buyer Review → immutable verified Review → UserReputation`

Community content:
`User → Post/Story → @mentions + public Service/Product references → discovery/conversation/opportunity`

Live commerce:
`Hustler → Live session → demonstration/conversation → pinned canonical Service/Product → existing Booking/Order transaction flow`

Community and Live interaction signals must never silently become verified reputation.

Private trust/safety:
`interaction/transaction evidence → private counterparty feedback + reports + blocks → explainable Admin intelligence → human moderation`

## Phase 14 — Trust + Reputation
COMPLETE — final end-to-end runtime validated 2026-09-16.

Validated:
- one-way verified provider reviews and atomic `UserReputation`
- private Hustler→Client / Seller→Buyer feedback kept separate
- reports across Booking, Order, Profile and Conversation contexts
- block/unblock authority and preserved historical evidence
- explainable Admin safety intelligence with human moderation
- durable moderation audit events
- unified Trust Activity center
- final xpen public reputation invariant: ratingSum 10, reviewCount 2, verifiedReviewCount 2, bookingReviewCount 1, orderReviewCount 1, averageRating 5

Canonical Phase 14 knowledge:
- `Knowledge/Product/TRUST_AND_REPUTATION.md`
- `Knowledge/Decisions/ADR-0013-verified-transaction-reviews.md`
- `Knowledge/Decisions/ADR-0015-one-way-public-reputation-reviews.md`
- `Knowledge/Decisions/ADR-0016-authoritative-release-state-ui.md`
- `Knowledge/Decisions/ADR-0017-verified-review-creation-and-reputation-projection.md`
- `Knowledge/Decisions/ADR-0018-private-counterparty-trust.md`
- `Knowledge/Decisions/ADR-0019-public-provider-trust-summary.md`
- `Knowledge/Decisions/ADR-0020-counterparty-trust-safety-foundation.md`
- `Knowledge/Decisions/ADR-0021-profile-conversation-safety-report-context.md`
- `Knowledge/Decisions/ADR-0022-explainable-admin-safety-intelligence.md`
- `Knowledge/Decisions/ADR-0023-full-trust-experience.md`

## Phase 15 — Public Hustle Storefront Website
COMPLETE.

Validated:
- public signed-out storefront read model
- `/u/:username` professional identity + published Services/Products/Posts + verified reputation
- no private trust/safety leakage
- canonical Service/Product/Post routes
- canonical URL, SEO/Open Graph/X metadata, copy/native/WhatsApp/X/email sharing and QR

Merges:
- foundation `a3798fea0ebd577c2f305419a57a9d2e81c26fb6`
- distribution `76a24ace7ac4c363a0e549978fdf29c1b61c80ef`
- email/closure `464f0f3cb162d5625deb2506a6a3c0224fd2da95`

Canonical Phase 15 knowledge:
- `Knowledge/Decisions/ADR-0024-public-storefront-read-model.md`
- `Knowledge/Decisions/ADR-0025-storefront-distribution.md`

## Phase 16 — Stories + Universal User Content
COMPLETE — final runtime validated 2026-09-17.

### 16A — Stories Foundation
Merge: `eaecc981f29a55cf587ae40fd885eb591e40e3e8`
Migration: `20260917110000_phase16a_stories`

### Universal User-content authority correction
Merge: `dcb73676e64e840f166fe8dd53f73d709b977ee0`
Runtime closeout: `cfa7174103941d427e0ac3422f65ed2a33316691`

Validated:
- Client-only and Hustler identities can create Posts and Stories
- Client-only publishing does not grant HUSTLER capability
- Client-authored Post/Story can `@mention` users and reference another Hustler's published Service/Product
- referenced offers remain owned by the canonical merchant
- review-style community content does not create verified Review records

### 16B — Stories Experience
Merge: `f0452ffbeb9a5649dffcb88c15f572b935b715f4`
Security hardening merge: `de3cff67727ab83b233c61a51c28a133936eb656`
Migrations:
- `20260917123000_phase16b_story_experience`
- `20260917124500_phase16b_story_rls_hardening`

Runtime validated:
- `story-media` native image/video upload
- Story application tables protected by RLS; no direct anon/authenticated table access
- unique viewer-key view deduplication
- HEART / FIRE / CLAP / HUNDRED reactions
- private replies readable only by creator/replier and protected by UserBlock policy
- Home active Stories rail
- sequential previous/next viewing and video completion advance
- Story → profile / Service / Product controlled conversion events
- no private reply content leakage in public interaction summaries
- xpen verified public reputation remained ratingSum 10, reviewCount 2, verifiedReviewCount 2, bookingReviewCount 1, orderReviewCount 1, averageRating 5

Migration recovery:
- the hosted Story RLS state existed before Prisma recorded `20260917124500_phase16b_story_rls_hardening`
- Prisma deploy therefore hit PostgreSQL `42710` on an already-existing Story policy
- the failed migration record was marked rolled back after hosted RLS/policies/grants were verified
- the repository migration is now retry-safe and deterministically revokes browser Data API table privileges before recreating the `hustle_api` policies
- stale raw `story_media_select_public` Storage policy was removed through Supabase migration authority

Canonical Phase 16 knowledge:
- `Knowledge/Decisions/ADR-0026-stories-foundation.md`
- `Knowledge/Decisions/ADR-0027-universal-user-content.md`
- `Knowledge/Decisions/ADR-0028-stories-experience.md`
- `Knowledge/Decisions/ADR-0029-story-table-data-api-hardening.md`

## Phase 17 — Live Commerce Beta
ACTIVE.

### 17A — Live Commerce Foundation
IMPLEMENTED + CI GREEN — runtime pending.

Merge: `ae8b843a67c56f502a8446700aa8fb3b41cbf745`
Migration: `20260917143000_phase17a_live_commerce_foundation`

Implemented:
- server-authoritative `DRAFT → LIVE → ENDED` session lifecycle
- hosting requires ACTIVE HUSTLER + PUBLISHED ProfessionalProfile
- public active Live directory and public Live viewer
- host control room
- optional real external playback URL; no fake native stream state
- public viewer heartbeat/presence counts using opaque viewer keys
- authenticated Live comments with UserBlock enforcement for non-host commenters
- host responses through the same room-comment authority
- one pinned canonical published Service or Product at a time
- pin authority restricted to the host's own offers
- pinned Service/Product actions route to existing canonical Booking/Order surfaces
- Live → profile / Service / Product controlled conversion SystemEvents
- Live tables API-owned with RLS and direct anon/authenticated Data API access revoked
- `nativeBroadcasting: false` until real in-app media transport exists

Canonical Phase 17 knowledge:
- `Knowledge/Decisions/ADR-0030-live-commerce-foundation.md`

Next Live slice after the 17A runtime gate:
- **17B — Native Live Media Transport**: browser camera/microphone capture, provider/ingest integration, server-issued publishing credentials, real playback delivery, connection/reconnect states and runtime proof. No provider secret or stream key may be committed or exposed publicly.

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
`HUSTLE_ADMIN_USER_IDS` is server-only.
Canonical local storefront origin: `NEXT_PUBLIC_WEB_URL=http://localhost:3001`.
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
**Phase 17A runtime: run normal Prisma deploy so the repaired Phase 16B hardening and `20260917143000_phase17a_live_commerce_foundation` apply cleanly; then verify Client-only hosting rejection, Hustler session creation/start/end, host-owned pin authority, public discovery/viewer presence, authenticated block-aware comments, canonical Service/Product actions, conversion events, Live-table RLS, ended-session behavior and unchanged xpen 10 / 2 / 5.0 public reputation invariant.**
