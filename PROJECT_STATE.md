# Hustle Project State

Updated: 2026-10-09

## Current AED capability
Build

## Current MVP phase
Weekend development checkpoint (Saturday 2026-10-10): PR #77 shared Experience System / six-destination mobile navigation MERGED (`3beb2ec19283c7b66119f94c4fdbf02a179d2add`), GitHub Foundation CI passed `38040258775`; not production-deployed, Monday visual acceptance pending. Phase20C1 social activity notifications MERGED as PR #78 (`330da33ca24c36d207dc60322608c53ddc7c4fc8`), Foundation CI run `38040547196` SUCCESS, isolated payment sandbox regression `38040547157` SUCCESS. First-time followers and Post comments/replies create idempotent, recipient-scoped in-app alerts atomically with original writes. Post discussion alerts group per recipient+Post before pagination, unread count and read actions are discussion-scoped. No new migration, no external push, no vanity likes/saves notification. `Knowledge/Decisions/ADR-0050-meaningful-social-activity-notifications.md`. NO production deployment and runtime acceptance intentionally deferred until Monday 2026-10-12. Application/verification/Live/review notifications and Phase21 analytics still to build. Owner has paused manual testing until Monday.

Weekend build directive (owner 2026-10-10): pause all owner/manual acceptance testing until Monday 2026-10-12; continue MVP implementation and systematic UI/UX design. No request for weekend test accounts, financial actions, production deployments, or hosted paid infrastructure. Keep automated CI/typecheck/build gates; do not confuse green CI with owner runtime acceptance. Priorities: Phase20 remaining meaningful notifications, Phase21 conversion/analytics, warm-neutral mobile-first experience system and responsive surface consistency. UX foundation branch `feat/ux-foundation-mobile-navigation`: semantic design tokens + accessible focus/reduced-motion + keyboard skip link + route-aware six-destination mobile dock (Discover, Search, Market, Inbox, Activity, You), notification-group badge and safe-area bottom spacing. Canonical `Knowledge/UX/HUSTLE_EXPERIENCE_SYSTEM_V1.md`. PR/CI and manual deployment pending; Monday consolidated QA planned.

Phase 20B isolated paid-Order sandbox: COMPLETE for local/CI integration, PR #76 MERGED (`39c67b8a5675e9b8ade017af9b003d88f07b262c`) 2026-10-09. Isolated Payment Sandbox workflow full pass `37947854960` and Hustle Foundation CI pass `37947855011` after final HMAC secret masking; historical Supabase Storage compatibility and duplicate Story-policy migration handled **only in disposable Postgres**. Fresh ephemeral PostgreSQL16 database, localhost Nest API, disposable buyer/seller/product, HMAC-authenticated payment webhook, Order PENDING→PAID→PROCESSING→SHIPPED→DELIVERED→COMPLETED all PASSED with verified correct buyer/seller notification recipients, at-most-once inventory and ledger capture, signed webhook retry protection, denied unauthorized actions, and inbox read isolation. Run with `npm run sandbox:payments` (Docker) or GitHub Actions → `Isolated Payment Sandbox`. **No hosted Supabase branch or Vercel API environment created**, no production DB/payment/keys/settings/deployments touched, no billing approval needed for ephemeral workflow. This is integration evidence only; production paid-Order runtime acceptance remains PARTIAL/PENDING. Canonical: `Knowledge/Technical/ISOLATED_PAYMENT_SANDBOX.md`.

Agent represented-Booking request detail correction — owner reported 2026-10-09 that Phase20B Booking cancellation, decline, Agent action notifications and permission-block checks worked, **except** the authorized Agent had no full Booking request detail page analogous to Hustler. Existing AgentClientOperations API already authorizes GET for the full Booking; Web had only summary cards. Feature branch `fix/agent-booking-request-detail` adds `/agent-workspace/representations/:principalUserId/bookings/:bookingId` with complete request facts, client, schedule, status, operational delegated actions, read-only payment boundary and access-denied fail-closed behavior, plus “Review full request” on every summary card. No API/database mutation/deployment. ADR-0049; `Knowledge/QA/AGENT_BOOKING_DETAIL_RUNTIME_ACCEPTANCE.md`. PR #75 MERGED as `7060d0a2dab10fbe1b67ec591664ea11fa459fb6` with GitHub CI SUCCESS (run `37941935853`). Owner confirmed Web updated on 2026-10-09 and Vercel independently confirms Web production READY at the exact merge SHA. Owner confirmed on 2026-10-09 that all four production smoke tests PASSED: Agent's full Booking request review and matching Hustler-visible details, modified schedule accepted with Agent attribution, BOOKING_MANAGE revocation immediately denying deep-link access, and no finance/escrow/completion/reputation controls. Agent full-detail UX regression resolved and accepted; broader wrong-principal, separate action paths and responsive test cases remain outstanding. No further deployment required.

Phase 20B — Booking + Order lifecycle notifications: MERGED PR #74 (`9b2370282af01fd9a69d7d33ef9616aaf0af664b`), full CI GREEN on 2026-10-09 after a TypeScript validation fix (Web/Admin/Mobile/API typechecks, Prisma generation, Web/Admin/API builds). Adds API-owned status notifications for Booking creation, direct/Agent-delegated transitions including authoritative FUNDED, Order checkout/authoritative PAID, and fulfillment/cancel transitions. Notification writes join successful existing state transactions; per-status dedup, recipient scoping, no financial mutation powers. Reuses Phase20A Notification table, NO database migration, NO external push or Web/Admin code changes. Owner confirmed API updated on 2026-10-09; Vercel independently verified API production READY at `9bcd33e7cb3e5301820880828b7a35e21bff61f0` (PR #74 inclusive). Web also independently verified READY at the same SHA. No deployment triggered by ChatGPT. Phase 20B production runtime acceptance PARTIAL as of 2026-10-09: owner confirmed Booking request→Hustler, accepted Booking→Client (applicable pricing path), and checkout→Seller plus correct Order navigation/no Buyer self-alert. Owner subsequently confirmed all four tests for Booking cancellation, decline, authorized Agent-assisted Booking notification/audit, and permission revocation denial passed on 2026-10-09, but reported the Agent lacked a full request detail page (PR #75 merged/deployed, four owner smoke tests passed 2026-10-09). Owner also confirmed the next four Phase20B checks passed on 2026-10-09: unpaid Order cancellation notifies Seller, repeat cancel rejects without duplicate alert, unrelated User C cannot access Order detail URL, and Order read-state plus Message notification grouping regressions remain correct. Phase20B runtime acceptance remains PARTIAL: payment-confirmed PAID and fulfillment PROCESSING/SHIPPED/DELIVERED/COMPLETED notification tests, paid-order cancellation prohibition, other idempotency and Booking unpaid completion/sandbox funding scenarios remain pending. No further deployment for the confirmed checks. ADR-0048 and `Knowledge/QA/PHASE20B_BOOKING_ORDER_NOTIFICATIONS.md` canonical. Phase20A grouped notifications owner confirmed live 2026-10-09; broader edge-case checks remain pending.

Phase 20A grouping correction — PR #73 MERGED (`ba70e5a7ab1ca8c3e4b42debffe7dbcd94747540`), full CI green on 2026-10-09. Owner's original direct-message notification tests passed but repeated messages from one conversation were creating separate cards. Fixed by grouping existing/future MESSAGE notifications per recipient+conversation in API read model before pagination, reporting per-thread unread counts, scoped mark-read and grouped Web titles. Production read-only SQL verified existing duplicate conversation events group correctly; no deletion, no data migration, no external push. Owner manually deployed API and Web from commit `7b5c10d` (both Vercel READY, verified 2026-10-09). Owner screenshot shows a single notification card for `5 new messages` and badge `1 unread`; grouped UI and basic read behavior owner-reported working. No schema migration or data deletion. The grouping correction production smoke test PASSED. Phase20A broader security/pagination/concurrency checks remain pending, as do follow-on marketplace event producers.

Phase 20A — Notifications Foundation: MERGED PR #72 (`ea142411fda852931fd7bfdc0b5bffcc31ca0868`); full GitHub CI passed 2026-10-09 (Web/Admin/Mobile/API typechecks, Prisma generation, Web/Admin/API builds). In-app inbox, per-user notification API/read state and atomic notifications for ordinary and Agent-assisted direct Messages implemented. Database migration `20261009130000_phase20a_notification_inbox` APPROVED AND APPLIED 2026-10-09 to verified production Supabase `pfgarmyygybmhiiuopym` (Supabase migration ledger version `20261009123129`), with table/enum/FK/index/RLS/grant security checks passing; no staging branch existed so isolated staging test was not performed. Production API and Web both verified READY on Vercel from commit `980352e49dd69fe9a115408355d35083ea386591`, which includes PR #72. These production deployments were already present when checked; no deployment was triggered by ChatGPT. The approved DB migration is now applied; initial direct-message/grouping frontend smoke tests owner-confirmed passing 2026-10-09, broader edge-case acceptance pending. Follow-on notifications for Bookings, Orders, applications, Live etc. not yet built.

Phase 19E — Appeals, Enforcement Review & Restoration (merged + database active; manual production/runtime acceptance pending)

Phase 19D — Marketplace Content Moderation & Enforcement (merged + database active; manual production/runtime acceptance pending)

Phase 19C — Marketplace Casework & Dispute Triage (merged + database active; runtime pending combined acceptance)

Phase 19B — Admin Capability + Application Operations: COMPLETE — owner-confirmed production runtime acceptance 2026-10-09. Hustler/Agent reviews and approval safeguards, assigned-reviewer/self-review denial, reasoned rejection, reversible capability suspension/reactivation, corresponding application states, retained history, CLIENT continuity, protected-action denial/recovery, audit evidence and no forbidden financial/reputation/account-ban actions passed.

Phase 19A — Admin Marketplace Operations Foundation: COMPLETE — owner-confirmed production runtime acceptance 2026-10-09. Overview, non-Admin denial, marketplace datasets, Trust & Safety navigation, user search and capability visibility, read-only user inspection, audit event history, Booking/Order status filters and finance read-only/no-money-operation boundaries all passed.

Admin automatic session auth — PR #71 MERGED (`9757971ebd64b3c54786f8a78901498d3e2a5381`); full PR CI green 2026-10-09. Standalone Admin now uses first-party Supabase email/password login with automatic session restoration and refresh, shared guard across all Admin routes, same-origin auth transport and server-enforced AdminGuard. Admin production NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are configured; API ADMIN_ORIGIN is configured. Owner confirmed successful Admin production deployment and runtime acceptance on 2026-10-09: login, session restoration after refresh, cross-route navigation, API data visibility, non-Admin denial and sign-out passed. No API redeploy required for PR #71, no schema migration, no automatic deployment. Canonical decision: `Knowledge/Decisions/ADR-0045-admin-authenticated-session.md`.

Phase 18E — Delegated Bookings + Client Messages (merged + database activated; PARTIAL production runtime acceptance, owner-confirmed 2026-10-08: represented Booking visibility/acceptance/conflict denial, decline, pre-funding cancellation, free-work start, forbidden completion/financial/reputation actions; CLIENT_MESSAGE_MANAGE read/reply, visible Agent attribution, preserved owner unread state, immediate message permission revocation denial and ordinary owner messaging all passed. Blocked-conversation enforcement passed on 2026-10-08. Still pending: sandbox-only paid FUNDED Booking start. Server-side message provenance (`delegatedByAgentUserId`) and Agent suspension/reactivation access enforcement were confirmed passing by the project owner on 2026-10-09. Unrelated-principal Booking isolation and immediate BOOKING_MANAGE revocation denial passed on 2026-10-08.)

Phase 18D — Delegated Operational Actions & Agent Business Workspace: COMPLETE — owner-confirmed production runtime validation 2026-10-08. PROFILE_MANAGE, SERVICE_MANAGE, PRODUCT_MANAGE, CONTENT_MANAGE, CLIENT-only capability boundaries, out-of-scope denial, immediate scope revocation and Agent actor/principal owner audit integrity all passed.

Phase 18B — Client Principal↔Agent Relationship + Scoped Permission Grants: COMPLETE — production runtime validated 2026-10-07.

Phase 18C — Agent-Assisted Onboarding & Hustler Registration: COMPLETE — production runtime validated 2026-10-07, including secure proof preview.

Agent authority + review-integrity correction — COMPLETE in PR #69 (`7b1d7d6b3ce7c23e042fb4a4b2a6c121856a43d7`); all five production runtime acceptance tests confirmed passing by the project owner 2026-10-08. No database migration. The correction makes ACCOUNT_ONBOARDING_MANAGE and HUSTLER_APPLICATION_MANAGE actionable for ordinary existing Client principals, clarifies assisted identity claim/login, exposes delegated Hustler-application provenance to Admin, and blocks public Agent↔principal reputation reviews without blocking legitimate commerce.

Assisted permissions + claim handoff correction — COMPLETE in PR #70 (`67e5c8bdd0e7ecf9b252ceda2482399d7c6c9685`); full CI passed, manual API/Web deployment at `f15ebead3823183045545d6bb716477f53d62900` READY, and production acceptance confirmed passing by the project owner on 2026-10-08. While an assisted identity is unclaimed, the Agent can correct optional scopes with freshly recorded consent. Claim closes Agent-controlled scope editing and private assisted-onboarding access; already consented relationship permissions remain in place but only the authenticated owner can edit or revoke them afterward through Manage Agents. No database migration. Canonical decision: `Knowledge/Decisions/ADR-0044-assisted-permissions-and-claim-handoff.md`.

Phase 17 — Live Commerce Beta: COMPLETE — implementation, production media/runtime validation and final mobile fullscreen/Quick View acceptance validated 2026-10-07.

Phase 18A — Verified Agent Capability Foundation: COMPLETE — implementation, database activation, manual production deployment and end-to-end runtime acceptance validated 2026-10-07.

Phase 13 — Payments + Escrow is COMPLETE.
Phase 14 — Trust + Reputation is COMPLETE.
Phase 15 — Public Hustle Storefront Website is COMPLETE.
Phase 16 — Stories + Universal User Content is COMPLETE — implementation, CI and runtime validated 2026-09-17.

Current active implementation milestone: **Phase 20A Notifications Foundation — merged, CI green, approved production database migration APPLIED AND VERIFIED; PRODUCTION API/WEB AT PHASE20A CODE (Vercel READY) + RUNTIME ACCEPTANCE PENDING.** Phase 19C–19E are merged with database activation but still awaiting their independent runtime acceptance. Phase 18E's isolated sandbox-funded Booking start remains outstanding.

Runtime acceptance backlog: Phases 19C–19E (merged, DB active, production acceptance pending) and the isolated sandbox-only paid FUNDED Booking start test for Phase 18E. Phases 19A and 19B are closed. Next implementation build from the approved feature map is Phase 20 — Notifications.

Phase 20A release gate: PR #72 merged with full CI green; owner explicitly approved database activation. Verified production Supabase project `pfgarmyygybmhiiuopym`; migration registered as `phase20a_notification_inbox` (`20261009123129`) and applied on 2026-10-09. Read-only follow-up verified Notification/enum, 9 columns, 4 indexes, required FK, RLS and 3 hustle_api policies, SELECT/INSERT/UPDATE for hustle_api, no DELETE, zero SELECT for anon/authenticated, zero rows. An isolated staging DB was unavailable; no staging tests claimed. API and Web were independently confirmed by Vercel READY on Phase20A code commit `980352e`, prior to the post-migration check; no additional deployment requested. Verify the existing production aliases and run user-facing acceptance. No production app releases triggered by ChatGPT. No automatic deployments or external push delivery. Canonical ADR: `Knowledge/Decisions/ADR-0046-phase20a-user-notification-inbox.md`; QA: `Knowledge/QA/PHASE20_NOTIFICATIONS_RUNTIME_ACCEPTANCE.md`.

Immediate runtime gate: PR #69 and PR #70 are production-accepted; Phase 18D delegated Profile, Service, Product and Content operations plus capability boundaries, scope revocation and audits are now owner-validated COMPLETE. Phase 18E tested Booking transitions/boundaries plus delegated Client Message read/reply, visible Agent attribution, unread-state preservation, message-grant revocation denial and ordinary messaging have passed owner runtime testing; unrelated-principal Booking isolation and immediate Booking-scope revocation denial have now passed; blocked-conversation enforcement has now passed; sandbox-only paid FUNDED Booking start remains pending; stored Agent message provenance and Agent suspension/reactivation enforcement passed owner testing on 2026-10-09, followed by Phase 19A–19E Admin Marketplace Operations. Phase 19A is now COMPLETE as of owner-confirmed 2026-10-09 acceptance. Phases 19B–19E remain pending their respective production checks. Keep each slice pending until its full checklist passes. API and Web are manually deployed from `f15ebead3823183045545d6bb716477f53d62900`; no automatic deployments or Vercel Git integrations. Deployments remain manual and owner-controlled.

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
- Any ACTIVE CLIENT may grant an ACTIVE AGENT scoped onboarding/application authority; the Client does not need HUSTLER first.
- ACCOUNT_ONBOARDING_MANAGE covers basic identity/profile details only and never delegates email, phone, password, auth subject, verification, wallet or reputation authority.
- HUSTLER_APPLICATION_MANAGE lets an Agent prepare and submit a Client's application but never approve or activate HUSTLER.
- Agent-assisted identities have no Agent-created password: the person claims via the same verified email with a self-chosen password, or via the same verified phone using OTP.
- Agent↔principal commerce may be legitimate, but current or former represented pairs cannot create public verified reputation Reviews for each other.
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
- `Knowledge/Decisions/ADR-0037-delegated-bookings-and-messages.md`
- `Knowledge/Decisions/ADR-0038-admin-marketplace-operations-read-model.md`
- `Knowledge/Decisions/ADR-0039-admin-capability-application-operations.md`

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
COMPLETE — owner-confirmed production runtime acceptance 2026-10-08 (all Phase 18D scenarios in the canonical 18D–19E combined checklist passed).

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


### Phase 18 runtime validation scheduling — 2026-10-07
The project owner explicitly deferred Phase 18D runtime testing until the Agent slices were ready for consolidated validation on 2026-10-08; Phase 18D has subsequently passed.

Phase 18D is marked complete only after owner confirmation of the combined runtime checks on 2026-10-08.

### 18E — Delegated Bookings + Client Messages
MERGED + DATABASE ACTIVATED — PARTIAL production runtime acceptance 2026-10-08: authorized Agent saw represented Hustler Booking, accepted REQUESTED Booking, verified conflicting acceptance denied, declined a separate REQUESTED Booking, cancelled a pre-funding ACCEPTED Booking, started free ACCEPTED work, and confirmed no Agent booking completion, refund, escrow release, wallet/payout or verified-review authority. The owner subsequently confirmed delegated Client Message read/reply, visible attribution for owner and recipient, unaffected owner unread indicator, immediate CLIENT_MESSAGE_MANAGE revocation denial, and ordinary messaging all passed. Further owner-confirmed 2026-10-08: Agent could read Hustler A Bookings but not read or mutate unrelated Hustler B Bookings; after principal A revoked BOOKING_MANAGE, the Agent immediately lost Booking access and mutations. Owner-confirmed 2026-10-08: blocked-conversation enforcement prevents delegated read/reply that UserBlock policy prohibits. Owner-confirmed 2026-10-09: stored `Message.delegatedByAgentUserId` attribution and suspended-Agent delegated-access denial passed, with reactivation restoring otherwise valid permissions. Only isolated sandbox-funded Booking start remains pending; never send fake funding events into production financial records.

Merge:
- PR #63 `287aa857ea14d871eae7b0bdf0226e262ba6ab28`

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
- `Message.delegatedByAgentUserId` verified present
- `Message_delegatedByAgentUserId_createdAt_idx` verified present
- `Message_delegatedByAgentUserId_fkey` verified present
- Message RLS remains enabled
- no new Phase-18E-specific security or unindexed-foreign-key advisor finding

Booking authority:
- `BOOKING_MANAGE` requires ACTIVE Agent relationship + exact scope + principal ACTIVE HUSTLER.
- Agent may list/read represented Hustler Bookings.
- Agent may accept REQUESTED Bookings using canonical schedule-conflict validation.
- Agent may decline REQUESTED Bookings.
- Agent may cancel only ACCEPTED/PAYMENT_PENDING Bookings before funding.
- Agent may start free ACCEPTED work or paid FUNDED work.
- no delegated Booking completion endpoint exists.
- no Agent funding/refund/escrow/payout/wallet/reputation authority.

Messaging authority:
- `CLIENT_MESSAGE_MANAGE` requires ACTIVE relationship + exact scope.
- Agent may read represented principal direct conversations and history.
- Agent reads do not update the principal's read state.
- Agent may send text replies on behalf of the principal.
- `Message.senderId` remains the principal to preserve canonical conversation semantics.
- `Message.delegatedByAgentUserId` records the real Agent actor.
- normal Hustle messaging surfaces render Agent-assisted provenance.
- no delegated attachment upload, typing impersonation, conversation deletion or participant mutation in this first slice.

Combined runtime acceptance for Phase 18D + 18E will be compiled after implementation/merge.


### Next major phase
Per the canonical MVP build plan, the next phase after Agent MVP is:

**Phase 19 — Admin + Marketplace Operations**

Goal: the Hustle team can operate users, capabilities, applications, content, reports, suspensions, bookings, orders, payments, escrow, disputes, moderation and audit logs without manual database access.

Phase 18D runtime validation is COMPLETE, confirmed by the project owner on 2026-10-08; Phase 18E runtime acceptance remains pending.


### 19A — Admin Marketplace Operations Foundation
COMPLETE — owner-confirmed production runtime acceptance 2026-10-09; all section C checks in the canonical 18D–19E acceptance checklist passed.

Merge:
- PR #64 `c24aaa7ebf0a46ca4679cc844b1275b92c493b07`

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
- no schema migration required.

Goal:
- give the Hustle team one authoritative control plane for operating the marketplace without direct database access.

Read model:
- overview across users, active capabilities, applications, Bookings, Orders, financial state, safety, content and audit events;
- user/capability search by ID, username, name, email or phone;
- per-user marketplace activity summary;
- pending Hustler/Agent application queues;
- recent/filterable Bookings and Orders;
- PaymentAttempt / escrow / payout / refund state without provider secret metadata;
- filterable SystemEvent audit history.

Admin app:
- root becomes Marketplace Operations;
- existing Trust & Safety console preserved at `/trust-safety`;
- same tab-session admin bearer token flow;
- all operations API routes require `AuthGuard + AdminGuard`.

19A deliberately does NOT add:
- user/capability suspension controls;
- Booking/Order mutation;
- payment confirmation;
- escrow release/refund;
- payout execution;
- Review/reputation mutation.

These higher-risk controls require explicit Phase 19 follow-on policy and audit decisions.


Phase 19A runtime acceptance COMPLETE, owner-confirmed 2026-10-09 after Admin auto-login validation and dedicated user search, Booking/Order filters, audit event visibility, finance read-only and prohibited money-operation checks.


### 19B — Admin Capability + Application Operations
COMPLETE — owner-confirmed production runtime acceptance 2026-10-09. Hustler and Agent application reviews, proof verification, eligibility and reviewer rules, rejection safeguards, reversible suspension/reactivation, CLIENT continuity, preserved application/Agent relationship history, protected action denial/restoration and audit evidence all passed. No bank, escrow, ban or reputation authority.

Merge:
- PR #65 `318d3b07df8c4cccd1c46216ecd2994b90bed0d8`

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
- no schema migration required.

Application operations:
- standalone Admin Console route `/applications`;
- Hustler + Agent queues in one workspace;
- start review;
- secure private proof preview;
- VERIFIED / REJECTED identity decision;
- approve + activate capability;
- reject with required reason;
- existing API self-review and reviewer-assignment rules remain authoritative.

Capability operations:
- user detail exposes reversible HUSTLER/AGENT suspension/reactivation;
- reason required for every operation;
- only ACTIVE → SUSPENDED and SUSPENDED → ACTIVE are supported;
- corresponding approved application mirrors SUSPENDED/APPROVED;
- original review notes are preserved;
- SystemEvent records admin actor, target user, capability and reason;
- temporary suspension does not destroy Agent relationship history.

Explicitly excluded:
- CLIENT suspension/ban;
- permanent capability revocation;
- financial operations;
- Review/reputation mutation.


### Consolidated runtime batch — planned for 2026-10-08
Runtime validation is intentionally pending for:
- Phase 18D — delegated Profile/Service/Product/Content operations: COMPLETE, owner-confirmed 2026-10-08;
- Phase 18E — delegated Bookings + Client Messages;
- Phase 19A — Admin Marketplace Operations read cockpit;
- Phase 19B — unified capability reviews + reversible HUSTLER/AGENT suspension/reactivation.

Do not mark any of these slices runtime-complete until the consolidated production acceptance session passes.


### Phase 19C — Marketplace Casework & Dispute Triage
MERGED + DATABASE ACTIVE — production runtime acceptance PENDING.

- PR #66 merged commit: `219a6ca1a784b1b7c2fafe77132b0ecf9731fbc5`
- Full CI green: web/admin/mobile typechecks, Prisma generation, API typecheck, web/admin/API production builds.
- Supabase migration `phase19c_marketplace_casework` applied successfully.
- Both `MarketplaceCase` and `MarketplaceCaseNote` verified with RLS enabled, no policies, anon SELECT=false, authenticated SELECT=false.
- Supabase's "RLS enabled, no policy" advisory is **intentional** for these inaccessible server-only tables. Existing unrelated security advisories remain open.
- No Vercel deployment was requested or performed by ChatGPT.
- Combined acceptance checklist: `Knowledge/QA/PHASE18D_19C_COMBINED_RUNTIME_ACCEPTANCE.md`.

Runtime acceptance joins the consolidated manual deployment/testing batch.

- Admin-only `/admin/operations/cases` API with AuthGuard + AdminGuard.
- Case subjects are verified existing Bookings or Orders; one case record per transaction.
- Human-owned priorities LOW/NORMAL/HIGH, independent of public reputation.
- Explicit OPEN → IN_REVIEW → WAITING_INFORMATION → RESOLVED → CLOSED state graph with controlled reopening.
- Admin can claim/release case; assigned admin can change state/priority and record private notes.
- Required notes/evidence for every state transition. Changes emit SystemEvents with actor identity.
- Database models: MarketplaceCase, MarketplaceCaseNote. RLS enabled with no client policies.
- Read-only linked Booking/Order, PaymentAttempt and escrow status in admin UI.
- `/cases` admin console route, with create-case links from the marketplace booking/order lists.
- **No** transaction state changes, refunds, escrow releases, payouts, Reviews/reputation edits, SafetyReport punishments or automatic enforcement.
- Decision: `Knowledge/Decisions/ADR-0040-marketplace-casework-and-dispute-triage.md`.


### Consolidated runtime sign-off supersedes the previous 18D–19B batch
The production acceptance batch now covers **18D, 18E, 19A, 19B, 19C**. Each must be checked against `Knowledge/QA/PHASE18D_19C_COMBINED_RUNTIME_ACCEPTANCE.md` after the project owner manually deploys latest API/Web/Admin.

**Do not mark Phase 19C or the other deferred slices runtime-complete on the basis of CI alone.** No production acceptance was performed in this build session.


### Phase 19D — Marketplace Content Moderation & Enforcement
MERGED + DATABASE ACTIVE — runtime acceptance PENDING.

- PR #67 merged SHA: `96565f3ada6fcc734cb7d43129b399e6e4746cd2`.
- Full CI green: web/admin/mobile typechecks, Prisma generation, API typecheck, web/admin/API builds.
- Hosted Supabase migration `phase19d_marketplace_content_enforcement` applied successfully.
- Post, Service, Product `moderationState` columns verified present.
- MarketplaceModerationAction RLS enabled; anon/authenticated direct SELECT false; hustle_api SELECT/INSERT true and UPDATE false; two API-only policies.
- Performance advisor may flag new indexes as unused before production traffic; historical security advisories remain.
- Runtime pending combined manual acceptance. No Vercel deployment requested or performed by ChatGPT.

- Admin-only `/admin/operations/moderation` API and `/moderation` admin console.
- POST/SERVICE/PRODUCT item-level CLEAR/HELD moderation status.
- HOLD forces Post ARCHIVED, Service/Product PAUSED.
- Owner and delegated Agent publish paths require CLEAR at database write time.
- Owner/Agent listing delete requires CLEAR so active investigations preserve the record.
- RELEASE clears restriction without automatically republishing.
- Every HOLD/RELEASE requires reason, append-only MarketplaceModerationAction and SystemEvent.
- Audit role hustle_api only, private RLS; browser database roles have no direct table privileges.
- Does not affect Booking, Order, payments, escrow, payout, Review, reputation, account capability or SafetyReport state.
- ADR: `Knowledge/Decisions/ADR-0041-reversible-marketplace-content-holds.md`.


### Consolidated manual runtime acceptance — current
Canonical checklist: `Knowledge/QA/PHASE18D_19E_COMBINED_RUNTIME_ACCEPTANCE.md`.

Pending slices: **18D, 18E, 19A, 19B, 19C, 19D, 19E**.
After the project owner manually deploys latest main to API/Web/Admin, validate each slice and record actual failures/retests before marking complete.

Phase 19D adds human-controlled Post/Service/Product HOLD/RELEASE without auto-republishing, account suspension, transaction/financial changes or reputation edits.


### Phase 19E — Appeals, Enforcement Review & Restoration
MERGED + DATABASE ACTIVE — runtime acceptance PENDING.

- PR #68 merged SHA: `ecf6dec2895880afe51114c410e77e097a68a3bc`.
- Corrected CI head: `8de3920c172ae8f0b4f631fc54f930bd9bb71c87`.
- Full CI green: web/admin/mobile typechecks, Prisma generation, API typecheck, web/admin/API production builds.
- Hosted Supabase migration `phase19e_enforcement_appeals` applied successfully.
- `EnforcementAppeal` RLS verified enabled.
- anon/authenticated direct SELECT=false.
- hustle_api SELECT/INSERT/UPDATE=true and DELETE=false with 3 API-role policies.
- New appeal indexes may show unused before runtime traffic; no Phase-19E-specific security advisor finding.
- No Vercel deployment requested or performed by ChatGPT.
- Canonical combined acceptance checklist: `Knowledge/QA/PHASE18D_19E_COMBINED_RUNTIME_ACCEPTANCE.md`.

Runtime acceptance remains deferred to the project owner's combined manual production session.

- User `/appeals` route exposed from Account.
- Only active current content holds and HUSTLER/AGENT suspensions are appealable.
- One appeal per exact enforcement event via unique `enforcementRef`.
- Content appeals reference immutable MarketplaceModerationAction HOLD records.
- Capability appeals reference durable `admin.capability.suspended` SystemEvents.
- Admin `/appeals` route supports queue, independent claim, decision and close.
- Original enforcing admin and appellant are prohibited from reviewing the appeal.
- Decisions: UPHELD or OVERTURNED.
- OVERTURNED releases only the same still-current restriction; newer enforcement cannot be removed by an older appeal.
- Content overturn uses RELEASE and never auto-republishes.
- Capability overturn uses existing HUSTLER/AGENT reactivation path.
- Original enforcement history is preserved; appeal lifecycle emits separate SystemEvents.
- RLS/server-only EnforcementAppeal table; no browser direct DB access and no delete endpoint.
- No Booking/Order, payment, escrow, payout, Review/reputation, MarketplaceCase or SafetyReport mutation.
- ADR: `Knowledge/Decisions/ADR-0042-independent-enforcement-appeals.md`.


### Consolidated manual runtime acceptance — Phase 19E extension
Canonical checklist is now `Knowledge/QA/PHASE18D_19E_COMBINED_RUNTIME_ACCEPTANCE.md`.
The previous 18D–19D checklist is superseded. Phase 19E remains build-time only until the project owner manually deploys and completes the combined production validation.


### Phase 19E release boundary
Build/database activation is complete, but **production behavior has not been manually accepted**.

The combined pending runtime batch is now:
- Phase 18D
- Phase 18E
- Phase 19A
- Phase 19B
- Phase 19C
- Phase 19D
- Phase 19E

Do not mark any of these runtime-complete until the relevant checks in `Knowledge/QA/PHASE18D_19E_COMBINED_RUNTIME_ACCEPTANCE.md` pass after a manual API/Web/Admin deployment.
