# Hustle Project State

Updated: 2026-09-17

## Current AED capability
Build

## Current MVP phase
Phase 16 — Stories + Universal User Content

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14 — Trust + Reputation is COMPLETE.
Phase 15 — Public Hustle Storefront Website is COMPLETE.
Phase 16A — Stories Foundation is COMPLETE — implementation, CI and runtime validated 2026-09-17.
Phase 16 universal-content authority correction is COMPLETE — CI and runtime validated 2026-09-17.

Current active slice: **Phase 16B — Stories Experience — IMPLEMENTED + CI GREEN; runtime migration/validation pending.**

## Binding product rules
- Hustle is a mobile-first, Nigeria-first capability-to-opportunity ecosystem.
- Core loop: `Skill → Demonstration → Discovery → Trust → Opportunity → Transaction → Reputation → Growth`.
- One User identity; everyone begins as CLIENT.
- HUSTLER and AGENT are additive capabilities on the same identity.
- No role switcher and no separate Client/Hustler/Agent accounts.
- **Posts and Stories are User-level content capabilities. Every authenticated Client or Hustler can publish.**
- HUSTLER is required for owning/selling professional Services and Products, not for having a public voice.
- Client-authored Posts/Stories may `@mention` users and reference any currently published Service/Product, including another Hustler's.
- Referencing another Hustler's Service/Product never transfers merchant ownership and never implies the content author owns the offer.
- Social recommendations, opinions and review-style Posts/Stories are community content and never manufacture verified reputation.
- Verified public reputation remains downstream of eligible transaction evidence and a canonical Review record.
- Story views, reactions and private replies are social/observation signals only and never affect verified `UserReputation`.
- Private Story replies must respect the existing UserBlock policy and never become a public comment surface.
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

Community content must never silently become verified reputation.

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
- `Knowledge/Decisions/ADR-0016-authoritative-release-state-read.md`
- `Knowledge/Decisions/ADR-0017-verified-review-creation-and-reputation-projection.md`
- `Knowledge/Decisions/ADR-0018-private-counterparty-trust.md`
- `Knowledge/Decisions/ADR-0019-public-provider-trust-summary.md`
- `Knowledge/Decisions/ADR-0020-counterparty-trust-safety-foundation.md`
- `Knowledge/Decisions/ADR-0021-profile-conversation-safety-report-context.md`
- `Knowledge/Decisions/ADR-0022-explainable-admin-safety-intelligence.md`
- `Knowledge/Decisions/ADR-0023-full-trust-experience.md`

## Phase 15 — Public Hustle Storefront Website
COMPLETE.

### 15A — Storefront Foundation
COMPLETE — CI + runtime validated 2026-09-16.

Validated:
- public signed-out `GET /api/v1/storefronts/:username`
- `/u/:username` composes professional identity, published Services/Products/Posts and verified reputation
- no private trust/safety leakage
- canonical real Service/Product/Post routes
- xpen runtime storefront: 1 Service, 1 Product, 2 Posts, 2 verified Reviews

Merge: `a3798fea0ebd577c2f305419a57a9d2e81c26fb6`

### 15B/15C — Storefront Distribution
COMPLETE — CI merged.

Built:
- canonical storefront URL
- dynamic SEO/Open Graph/X metadata
- copy/native/WhatsApp/X/email sharing
- QR representation of canonical URL
- public-data-only metadata/share payloads

Merges:
- distribution `76a24ace7ac4c363a0e549978fdf29c1b61c80ef`
- email/closure `464f0f3cb162d5625deb2506a6a3c0224fd2da95`

Canonical Phase 15 knowledge:
- `Knowledge/Decisions/ADR-0024-public-storefront-read-model.md`
- `Knowledge/Decisions/ADR-0025-storefront-distribution.md`

## Phase 16 — Stories + Universal User Content
ACTIVE.

### 16A — Stories Foundation
COMPLETE — implementation + CI + runtime validated 2026-09-17.

Merge: `eaecc981f29a55cf587ae40fd885eb591e40e3e8`
Migration: `20260917110000_phase16a_stories`

Validated foundation:
- TEXT / IMAGE / VIDEO Stories
- fixed server-owned 24-hour lifetime
- public active Story list/detail
- authenticated create/mine/delete
- `/stories`, `/stories/create`, `/stories/:storyId`
- Story publication/removal SystemEvents
- canonical Service/Product action routing

### Phase 16 universal-content authority correction
COMPLETE — implementation + CI + runtime validated 2026-09-17.

Merge: `dcb73676e64e840f166fe8dd53f73d709b977ee0`

Validated:
- Client-only identity can create and publish Posts
- Client-only identity can create Stories
- Client-only users do not gain HUSTLER capability by publishing content
- Client-only Post storage may use an internal DRAFT ProfessionalProfile compatibility anchor, but public professional context remains absent until legitimately published
- public Posts from Client and Hustler identities are eligible for discovery and normal interactions
- Client-authored Post/Story can `@mention` `xpen`
- Client-authored Post/Story can reference xpen's published Service `cmttw02cy0001dc02zzd5j89x`
- Client-authored Post/Story can reference xpen's published Product `cmtty8gfs0001dcavtny1iiuh`
- referenced offers still route to their canonical Hustle entities and remain owned by xpen
- review-style community content does not create a verified Review
- xpen public `UserReputation` remains unchanged after the cross-identity content test: ratingSum 10, reviewCount 2, verifiedReviewCount 2, bookingReviewCount 1, orderReviewCount 1, averageRating 5

### 16B — Stories Experience
IMPLEMENTED + CI GREEN — runtime pending.

Migration: `20260917123000_phase16b_story_experience`

Implemented:
- unique Story views using opaque browser viewer keys and `(storyId, viewerKey)` deduplication
- authenticated one-reaction-per-user Story reactions: HEART / FIRE / CLAP / HUNDRED
- private Story replies visible only to the Story creator and the reply author
- existing UserBlock policy enforced on private Story replies
- public Story interaction counts without exposing private reply content
- sequential previous/next Story viewer with video completion advancing to the next active Story
- native authenticated Story photo/video upload through dedicated `story-media` Supabase Storage bucket
- Story media ownership enforced through auth-subject path validation + owner-scoped Storage RLS
- image limit 10 MB; video limit 50 MB with explicit MIME allowlist
- active Stories rail directly on Home plus Add Story entry
- controlled Story → profile / Service / Product conversion SystemEvents with server-derived targets
- Story interaction signals remain separated from verified reputation authority

Canonical Phase 16 knowledge:
- `Knowledge/Decisions/ADR-0026-stories-foundation.md`
- `Knowledge/Decisions/ADR-0027-universal-user-content.md`
- `Knowledge/Decisions/ADR-0028-stories-experience.md`

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
**Phase 16B runtime: deploy `20260917123000_phase16b_story_experience`; verify `story-media` bucket/RLS, unique view deduplication, reactions, private block-aware replies, Home Stories rail, sequential viewing, native image/video upload, Story conversion events, private-reply non-leakage, and the unchanged xpen 10 / 2 / 5.0 public reputation invariant.**
