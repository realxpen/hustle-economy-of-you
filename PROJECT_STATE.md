# Hustle Project State

Updated: 2026-10-07

## Current AED capability
Build

## Current MVP phase
Phase 18D — Delegated Operational Actions & Agent Business Workspace (merged; manual production deployment/runtime acceptance pending)

Phase 18B — Client Principal↔Agent Relationship + Scoped Permission Grants: COMPLETE — production runtime validated 2026-10-07.

Phase 18C — Agent-Assisted Onboarding & Hustler Registration: COMPLETE — production runtime validated 2026-10-07, including secure proof preview.

Phase 17 — Live Commerce Beta: COMPLETE — implementation, production media/runtime validation and final mobile fullscreen/Quick View acceptance validated 2026-10-07.

Phase 18A — Verified Agent Capability Foundation: COMPLETE — implementation, database activation, manual production deployment and end-to-end runtime acceptance validated 2026-10-07.

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14 — Trust + Reputation is COMPLETE.
Phase 15 — Public Hustle Storefront Website is COMPLETE.
Phase 16 — Stories + Universal User Content is COMPLETE — implementation, CI and runtime validated 2026-09-17.

Current active slice: **Phase 18D Delegated Operational Actions & Agent Business Workspace — real permission-enforced Agent actions with actor-vs-owner auditability.**

Phase 17 is CLOSED. All four final production runtime checks were confirmed by the project owner on 2026-10-07.

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
- Phase 17 — Live Commerce Beta: COMPLETE
- Phase 18A — Verified Agent Capability Foundation: COMPLETE
- Phase 18B — Client Principal↔Agent Relationship + Scoped Permission Grants: COMPLETE
- Phase 18C — Agent-Assisted Onboarding & Hustler Registration: COMPLETE

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
COMPLETE — final production runtime acceptance validated 2026-10-07.

### 17A — Live Commerce Foundation
COMPLETE — implementation, CI, migration recovery and end-to-end runtime validated 2026-09-18.

Merge: `ae8b843a67c56f502a8446700aa8fb3b41cbf745`
Auth wiring hotfix: `c8150ca56bb2024da3ae33b3561f5f8a49a6b918`
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

Runtime validated:
- Client-only hosting rejection
- Hustler Live creation and control-room access
- DRAFT → LIVE → ENDED lifecycle
- host-owned Service pinning and canonical View & book routing
- public Live discovery/viewer flow and viewer presence
- authenticated Live comments and host responses
- external playback path when supplied
- ended sessions disappear from the active directory while remaining directly readable
- API startup auth dependency wiring corrected by importing AuthModule into LiveModule
- xpen verified public reputation remained unchanged

### 17B — Native Live Media Transport
COMPLETE — implementation, CI and production runtime/media validation passed.

Migration:
- `20260918110000_phase17b_native_live_media`

Implemented:
- LiveKit-compatible WebRTC transport boundary
- server-only `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
- 10-minute server-signed host publishing credentials
- host publish grants limited to camera + microphone
- signed-out subscribe-only viewer credentials using hashed opaque viewer identity
- browser camera/microphone publishing controls
- camera/microphone mute/unmute and disconnect controls
- host connection, reconnect and permission/error states
- viewer track subscription, playback, audio unlock and full-rejoin recovery
- API-owned `LiveMediaPresence` heartbeat projection so `nativeBroadcasting` reflects a recent real publisher
- native Live preferred over external playback when broadcasting is active
- external playback retained as legitimate fallback
- secret-safe `npm run live:setup`
- `npm run live:up` uses Docker when available and otherwise downloads/runs the pinned official LiveKit Server v1.13.7 Linux binary from a gitignored local tools cache
- no reusable provider secret or stream key committed or exposed through public APIs

Canonical Phase 17 knowledge:
- `Knowledge/Decisions/ADR-0030-live-commerce-foundation.md`
- `Knowledge/Decisions/ADR-0031-native-live-media-transport.md`

Runtime validated:
- production native Live media transport functions with real camera/microphone broadcasting
- publisher/viewer media lifecycle and native broadcasting state behaved correctly in production
- camera/microphone controls, viewer playback and reconnection paths were validated during Phase 17 runtime testing
- Live media remained separate from canonical Booking/Order/payment/reputation authority
- final Phase 17 acceptance included native mobile fullscreen behavior

## Phase 17C/17D — Production Live Viewer + Commerce Polish
COMPLETE — implementation, merge and final production runtime acceptance validated 2026-10-07.

Latest merge:
- PR #54 merge `7033cbb11331f6e9943583f94f2ee6c672505e39`

Validated in CI / implemented:
- production Live viewer lifecycle, delta chat and viewer presence
- pinned canonical Service/Product commerce actions
- mobile WebKit/native-video fullscreen fallback
- reusable Product/Service Quick View
- desktop modal + mobile bottom sheet
- Quick View from Live pinned offers, Home feed references and individual Post pages
- canonical Service/Product pages remain authoritative for transaction actions

Final production runtime checks PASSED:
1. Mobile native Live → Fullscreen entered native phone fullscreen.
2. Live pinned Product/Service → Quick View opened without leaving Live and the full-details CTA worked.
3. Home feed attached Product/Service → Quick View opened without leaving the feed.
4. Post page attached offer → Quick View opened and showed canonical provider/offer information.

Phase 17 is therefore CLOSED.

## Phase 18 — Agent MVP
ACTIVE.

### 18A — Verified Agent Capability Foundation
COMPLETE — implementation, CI, database activation, manual production deployment and end-to-end runtime validated 2026-10-07.

Architecture:
`CLIENT → optional HUSTLER → optional AGENT`

There is one User identity and no role switcher.

Implemented and merged in PR #55 (`c91efb952d90080bf6fc97bc9ff3347a4932a30b`):
- Agent application lifecycle
- private Agent application proof
- admin-only review authority
- separate identity verification state
- atomic approval → `UserCapability(AGENT, ACTIVE)`
- approval preserves CLIENT and any existing HUSTLER capability
- review/verification/approval/rejection SystemEvents
- web Agent application surface
- internal Agent review surface

Critical boundary:
- AGENT approval does not create a Hustler↔Agent relationship
- no delegated access to another Hustler exists in 18A
- no Agent authority over another Hustler's identity, profile, Service/Product ownership, messages, bookings, wallet, ledger, escrow, payouts, Reviews or reputation
- Phase 18B must introduce explicit Hustler-granted relationships, scoped permissions and actor-vs-owner auditability

Canonical Phase 18 knowledge:
- `Knowledge/Product/AGENT_MVP.md`
- `Knowledge/Decisions/ADR-0032-agent-capability-foundation.md`
- `Knowledge/Decisions/ADR-0033-agent-relationships-and-scoped-authority.md`
- `Knowledge/Decisions/ADR-0034-client-principal-agent-authority.md`
- `Knowledge/Decisions/ADR-0035-agent-assisted-onboarding.md`
- `Knowledge/Decisions/ADR-0036-delegated-operational-actions.md`

Production activation and runtime acceptance:
- Supabase migration `phase18a_agent_capability_foundation` applied successfully on 2026-10-07
- `AgentApplication` and `AgentApplicationProof` verified present
- private `agent-proofs` bucket verified present
- current API/web were manually deployed by the project owner
- existing account capabilities remained intact
- Agent draft save, private proof upload and submission succeeded
- a different authorized admin identity could see the Agent queue, start review and open the signed private proof preview
- identity verification was marked VERIFIED before approval
- approval activated `AGENT · ACTIVE` on the same unified account while preserving existing capabilities
- approved Agent application state rendered correctly
- no interface or authority exists yet for managing another Hustler; this absence is intentional and validates the 18A delegation boundary

### 18B — Client Principal↔Agent Relationship + Scoped Permission Grants
COMPLETE — implementation, database activation, manual production deployment and runtime acceptance validated 2026-10-07.

Merges:
- PR #56 feature merge `18e6042c172e93419672f12d9f1a884570b11bf4`
- PR #57 advisor/index hardening merge `a6842fccb289b3dc6e46dce2e7b5873eb993a553`

CI:
- web typecheck ✅
- admin typecheck ✅
- mobile typecheck ✅
- Prisma generation ✅
- API typecheck ✅
- web build ✅
- admin build ✅
- API build ✅

Hosted database:
- `phase18b_agent_relationship_permissions` applied successfully
- `AgentRelationship`, `AgentPermissionGrant` and `AgentDelegationAudit` verified with RLS enabled
- direct `anon` / `authenticated` table SELECT access revoked
- `hustle_api` policies and CRUD authority verified
- `phase18b_relationship_revoker_index` applied after the Supabase advisor flagged the new revoker foreign key
- `AgentRelationship_revokedByUserId_idx` verified present and the Phase-18B-specific unindexed-FK advisor finding cleared
- no new Phase-18B-specific security advisor finding

Implemented authority:
- ACTIVE CLIENT principal can initiate an invitation to an ACTIVE Agent
- Agent acceptance/decline
- ACTIVE relationship required before any permission can authorize a future delegated action
- independent named scopes for profile, services, products, content, bookings and client messages
- Client-principal permission updates and revocation
- Agent voluntary leave
- multiple Client principals per Agent through separate relationships
- blocked-user relationship prevention
- dedicated actor-vs-principal-owner `AgentDelegationAudit`
- existing owner-only business write routes remain unchanged in 18B
- no wallet, escrow, payout, Review or reputation delegation

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
ChatGPT commits directly to `realxpen/hustle-economy-of-you`. The project owner pulls and performs development-machine/runtime validation.

Vercel automatic Git deployments are disabled. ChatGPT must not trigger, retry, promote or create Vercel deployments. Production deployment is performed manually by the project owner.

Before pulling:
1. `git status`
2. commit/push intentional local source changes only
3. `git pull --rebase origin main`
4. use Node 22
5. restore generated `apps/web/next-env.d.ts` after builds rather than committing it

Use fresh auth sessions/tokens for runtime validation. Never commit or print provider/webhook/admin secrets.

## Next gate

Phase 18B implementation, CI and hosted database activation are complete.

The remaining gate is **manual production deployment by the project owner + runtime acceptance**.

18B acceptance must prove:
- a newly created CLIENT account can see Manage Agents and invite an ACTIVE Agent with explicit scopes
- Agent must accept before relationship becomes ACTIVE
- Agent can represent multiple Client principals independently
- Client principal can change scopes and revoke authority
- Agent can leave
- audit records distinguish Agent actor from Client principal owner
- blocked users cannot create/activate representation
- no delegated business controls exist yet despite the stored grants
- no wallet, escrow, payout, Review or reputation authority is transferred

Phase 17 and Phase 18A are CLOSED and must not be reopened unless a regression is found.


### Phase 18B product correction — 2026-10-07
MERGED in PR #58 (`4e09ba09b1a3ffff10f666924f4d4adac91d6602`).

The initial 18B implementation incorrectly gated **Manage Agents** and relationship creation behind ACTIVE HUSTLER.

Correct product rule:
- every normal Hustle identity begins with ACTIVE CLIENT;
- CLIENT is sufficient to appoint/manage an Agent;
- an Agent relationship may exist before Hustler activation;
- the relationship does not create HUSTLER capability;
- future Hustler-only delegated operations must separately enforce the principal's ACTIVE HUSTLER capability;
- Prisma now exposes the owner logically as `principalUserId` / `principal` while mapping to the existing hosted `hustlerUserId` column for data compatibility.
- full CI passed after the correction; no database migration was required.
- no Vercel deployment was created by the merge.


### Internal review authorization correction — 2026-10-07
Hustler capability review now uses the same `HUSTLE_ADMIN_USER_IDS` / `AdminGuard` authority as Agent review.

The legacy `HUSTLE_REVIEWER_EMAILS` requirement is no longer authoritative for Hustler approvals.

Web internal review hub:
- `/internal`
- `/internal/hustler-reviews`
- `/internal/agent-reviews`


### 18C — Agent-Assisted Onboarding & Hustler Registration
COMPLETE — implementation, database activation, manual production deployment and runtime acceptance validated 2026-10-07.

Merge:
- PR #60 `572a3022491a44973c635c7290b3421a5f5a6b59`

CI:
- web typecheck ✅
- admin typecheck ✅
- mobile typecheck ✅
- Prisma generation ✅
- API typecheck ✅
- web build ✅
- admin build ✅
- API build ✅

Hosted database:
- new Agent permission scopes `ACCOUNT_ONBOARDING_MANAGE` and `HUSTLER_APPLICATION_MANAGE` verified present
- `AgentAssistedRegistration` verified present
- RLS enabled
- direct `anon` / `authenticated` table access revoked
- `hustle_api` policy and CRUD authority verified
- no new Phase-18C-specific security or unindexed-foreign-key advisor finding
- hosted SQL was applied in controlled direct steps because the migration connector blocked the combined call before execution; repository migration remains retry-safe for later migration-history reconciliation.

Product rule:
- an Agent may help a CLIENT or a person who has not yet operated Hustle themselves;
- the person does not need to become a Hustler before Agent assistance begins;
- an ACTIVE Agent may create an assisted CLIENT identity from the Agent workspace after explicit consent;
- the person remains owner/principal and the Agent is recorded as actor;
- no password sharing or Agent-owned login is allowed;
- Agent may prepare private proof and submit the person's Hustler application;
- admin approval remains independent;
- assisted registration provenance is visible in the Hustler review screen;
- the person may later claim the same identity using a uniquely matching verified email/phone;
- account/application history survives claim;
- financial and reputation authority remain non-delegable.

Runtime gate after merge/database activation:
1. Agent creates a CLIENT-only assisted identity from one device.
2. New assisted identity appears in Agent workspace without requiring a second login/device.
3. Agent saves Hustler application, uploads proof and submits it.
4. Admin sees the application plus assisting Agent/consent context.
5. Admin can review/approve normally; HUSTLER is added to the person's identity, not Agent.
6. If the person later signs up with the recorded verified email/phone, Hustle claims the existing identity rather than creating a duplicate.


### Internal review access closeout — 2026-10-07
PR #59 merged as `4227080ea9470426547098a3f8af11582656e22a`.

Hustler review now uses the same `HUSTLE_ADMIN_USER_IDS` / `AdminGuard` authority as Agent review.

Internal web entry point after manual deployment:
- `/internal`
- Hustler queue: `/internal/hustler-reviews`
- Agent queue: `/internal/agent-reviews`

At database verification time, the Hustler review queue contained one SUBMITTED application.


### Secure proof preview fix — 2026-10-07
PR #61 merged as `515616cf7ee6e47b42f167e17b77123b6094dc58`.

Root cause:
- Hustler and Agent review services require a server-only Supabase secret key to mint 5-minute signed Storage URLs.
- production API currently has `SUPABASE_PUBLISHABLE_KEY` but not `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
- review UI also opened the new tab only after an async request, which can be blocked by mobile Safari.

Merged fix:
- proof tab is opened synchronously from the reviewer click, then navigated to the signed URL;
- same-tab fallback is used if a popup cannot be opened;
- API accepts `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY`;
- missing server key produces an explicit configuration error.

Runtime closeout:
- server-only `SUPABASE_SECRET_KEY` configured on the API;
- latest API + web manually deployed by the project owner;
- secure Hustler proof preview passed;
- secure Agent proof preview passed;
- all other Phase 18B/18C runtime flows had already passed.

Phase 18B and Phase 18C are CLOSED unless a regression is found.

### Recommended next build after proof-preview acceptance
Phase 18D — Delegated Operational Actions & Agent Business Workspace.

Goal:
- begin enforcing the stored relationship scopes on real delegated actions;
- Agent selects a represented principal from Agent Workspace;
- each action preserves Agent actor vs principal owner and writes audit records;
- start with lower-risk operational surfaces: professional profile, Services, Products and Content;
- Bookings and Client Messages follow only after those owner/actor boundaries are proven;
- wallet, ledger, escrow, payouts, Reviews and reputation remain non-delegable.


### 18D — Delegated Operational Actions & Agent Business Workspace
MERGED — manual production deployment/runtime acceptance pending.

Merge:
- PR #62 `3713d027d3b238a4fcb5c8869d0eb9f689da8441`

CI:
- web typecheck ✅
- admin typecheck ✅
- mobile typecheck ✅
- Prisma generation ✅
- API typecheck ✅
- web build ✅
- admin build ✅
- API build ✅

Database:
- no new schema migration required; 18D activates the existing Phase 18B relationship/permission/audit model.

First operational slice:
- dedicated `/agent-business/:principalUserId/*` API; owner routes remain unchanged
- Agent Business Workspace launched from an ACTIVE representation
- `PROFILE_MANAGE` → read/save/publish/unpublish Professional Profile
- `SERVICE_MANAGE` → list/create/save/publish/pause/delete Services
- `PRODUCT_MANAGE` → list/create/save/publish/pause/delete Products
- `CONTENT_MANAGE` → list/create/save/add/remove media/publish/archive Posts
- Profile/Services/Products require principal `HUSTLER · ACTIVE`
- Content remains User-level and works for CLIENT principals
- every delegated mutation re-checks relationship/scope/block state server-side
- every delegated mutation writes `AgentDelegationAudit` + `SystemEvent` with Agent actor vs principal owner
- revocation must immediately stop further actions

Explicitly excluded from this first slice:
- Bookings
- Client Messages
- wallet / ledger / escrow / payouts
- Reviews / reputation
- login or identity ownership

Runtime acceptance after merge must prove:
1. Agent with PROFILE_MANAGE can update/publish a represented Hustler profile.
2. Removing PROFILE_MANAGE immediately blocks another profile write.
3. Agent with SERVICE_MANAGE can create/edit/publish/pause a Service owned by the principal.
4. Agent with PRODUCT_MANAGE can create/edit/publish/pause a Product owned by the principal.
5. Agent with CONTENT_MANAGE can create/edit/media/publish a Post owned by the principal.
6. A CLIENT-only principal may receive delegated Content management but cannot use Profile/Service/Product delegated operations.
7. Agent cannot mutate a principal outside their ACTIVE relationship or without the exact scope.
8. AgentDelegationAudit records actor=Agent and owner=principal for each tested mutation.
9. Existing wallet, payment, Review and reputation state remains unchanged.
