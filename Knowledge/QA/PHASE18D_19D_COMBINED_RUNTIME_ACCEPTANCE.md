# Hustle — Consolidated Production Runtime Acceptance (18D–19D)
**Target session:** 2026-10-08 (or next manual validation session)
**Slices:** 18D, 18E, 19A, 19B, 19C, 19D
**Status:** PENDING — no user runtime checks performed yet

## Before testing
1. Manually deploy the latest `main` to **API + Web + Admin**. Vercel auto-deploy remains disabled. ChatGPT must not deploy.
2. Confirm the Phase 18E message provenance and Phase 19C casework migrations were applied to the connected Supabase database.
3. Prepare distinct signed-in **Admin**, **ACTIVE AGENT**, **ACTIVE HUSTLER**, and **CLIENT-only** test identities. Keep admin reviewer separate from applicants.
4. Use disposable content, services, products, messages and transaction examples. **Do not trigger real escrow release/refund/payout** as part of this test.
5. Record actual errors/screenshots and the date/commit of deployment.

## A — 18D Delegated Profile / Service / Product / Content
- [ ] With a valid ACTIVE Agent relationship and PROFILE_MANAGE, Agent edits/publishes a represented Hustler profile. Owner remains Hustler; Agent appears only as audited actor.
- [ ] With SERVICE_MANAGE, Agent creates/edits/publishes/pauses a Service owned by that Hustler.
- [ ] With PRODUCT_MANAGE, Agent creates/edits/publishes/pauses a Product owned by that Hustler.
- [ ] With CONTENT_MANAGE, Agent creates/edits/media-attaches/publishes a Post owned by the principal.
- [ ] CLIENT-only principal can delegate Content, but not professional Profile/Service/Product operations.
- [ ] Removing one grant immediately blocks the corresponding mutation. No Agent can act for an unrelated principal.
- [ ] Delegated mutations create AgentDelegationAudit + SystemEvent and do not alter wallet/reputation.

## B — 18E Delegated Bookings / Client Messages
- [ ] Agent with BOOKING_MANAGE can list/read only represented Hustler Bookings.
- [ ] Agent accepts a REQUESTED Booking; schedule conflicts remain blocked.
- [ ] Agent declines a separate disposable REQUESTED Booking; can cancel an ACCEPTED / PAYMENT_PENDING Booking before funding.
- [ ] Free ACCEPTED work or paid FUNDED work can be started. **Never use real funds for test fixtures.**
- [ ] Agent **cannot** complete a Booking, refund, release escrow, change wallet/payout state or manipulate Reviews.
- [ ] With CLIENT_MESSAGE_MANAGE, Agent reads the represented principal's existing direct conversations and sends a text reply.
- [ ] Recipient **and principal** see Agent-assisted attribution; the actual Agent is stored in delegatedByAgentUserId.
- [ ] Agent reading alone does not clear the principal's unread indicator; message blocks are honored.
- [ ] Revoking CLIENT_MESSAGE_MANAGE/BOOKING_MANAGE or suspending Agent immediately blocks delegated actions.
- [ ] Ordinary nondelegated messaging still sends and displays normally.

## C — 19A Admin Marketplace Operations
- [ ] Admin console root loads overview metrics using AdminGuard; unauthorized account is denied.
- [ ] User search by username/name/email/ID shows capability state without allowing edits in read surfaces.
- [ ] Hustler and Agent application queues, Bookings, Orders, financial snapshots and audit events load.
- [ ] Booking/Order filters work and reflect canonical statuses; finance remains read-only.
- [ ] Existing Trust & Safety console at `/trust-safety` remains accessible to authorized admins.

## D — 19B Capability / Application Operations
- [ ] Admin opens `/applications` and reviews an eligible Hustler application: start, secure proof preview, verification and approve.
- [ ] Admin opens a separate Agent application: start, verify, approve; assigned reviewer rules and self-review prohibition hold.
- [ ] Rejection cannot proceed without a reason. Approval cannot proceed without VERIFIED identity and proof.
- [ ] Using a disposable test account, Admin suspends HUSTLER or AGENT with mandatory reason.
- [ ] Corresponding approved application mirrors SUSPENDED; CLIENT remains ACTIVE; original review notes are preserved.
- [ ] Suspended Agent/Hustler loses protected mutation authority, but relationship history is not deleted.
- [ ] Admin reactivates the test capability with a required reason; status returns ACTIVE/APPROVED; audit records actor/target/reason.
- [ ] No CLIENT-ban, permanent revocation, money or reputation mutations appear.

## E — 19C Marketplace Casework / Dispute Triage
- [ ] Admin opens `/cases`; unauthorized and CLIENT/AGENT/HUSTLER-only accounts cannot access API.
- [ ] Case creation with unknown Booking/Order ID is rejected; a valid transaction opens one case.
- [ ] A duplicate case for the same transaction returns conflict, not a second case.
- [ ] Admin claims an unassigned case; another admin cannot silently take over an assigned case.
- [ ] Assigned Admin writes evidence notes; other admins cannot append or change case state.
- [ ] OPEN → IN_REVIEW → WAITING_INFORMATION → IN_REVIEW → RESOLVED → CLOSED follows documented transitions.
- [ ] Every status/priority change requires a reason; records attributed notes and durable SystemEvents.
- [ ] Resolve records a resolution; reopen clears stale resolution and timestamps. A released closed case can be claimed and reopened.
- [ ] Case shows current canonical Booking/Order/Payment/Escrow statuses but edits **none** of them.
- [ ] Confirm no automatic refund, release, payout, Review, reputation, capability suspension or SafetyReport punishment.
- [ ] Verify MarketplaceCase/MarketplaceCaseNote RLS on, no direct anon/authenticated database table access.

## F — 19D Content Moderation & Enforcement
- [ ] Admin opens `/moderation`; ordinary CLIENT, HUSTLER and AGENT identities are denied moderation API access.
- [ ] Admin lists Posts, Services and Products and inspects an exact content ID/owner.
- [ ] Admin applies HOLD to a published disposable Post with a required, documented reason; Post becomes ARCHIVED and non-public.
- [ ] Owner cannot republish held Post; an Agent with CONTENT_MANAGE cannot republish it either.
- [ ] Admin applies HOLD to a published Service and a Product. Both become PAUSED and disappear from public discovery.
- [ ] Owner and delegated Agent cannot republish or delete held Services/Products.
- [ ] Holding already-held content and releasing non-held content return a conflict; missing content returns not found.
- [ ] HOLD and RELEASE each produce immutable MarketplaceModerationAction and SystemEvent records identifying actor, owner, reason and status.
- [ ] Admin releases each hold with an explicit reason. The item remains ARCHIVED/PAUSED and is **not republished automatically**.
- [ ] After release, eligible owner/Agent may explicitly republish, subject to existing content validators.
- [ ] A moderation hold does not change CLIENT/HUSTLER/AGENT capability, Booking/Order, escrow/refund/payout, Review/reputation, SafetyReport or casework state.
- [ ] Verify MarketplaceModerationAction RLS and dedicated hustle_api read/insert policy; anon/authenticated have no direct table privileges.
- [ ] Existing Trust & Safety console, Agent business workspace and public feed/storefront still operate as expected.

## Final sign-off
- [ ] API deployment SHA: ______
- [ ] Web deployment SHA: ______
- [ ] Admin deployment SHA: ______
- [ ] Validation date and testers: ______
- [ ] Failed cases / screenshots: ______
- [ ] Regression retest after any fix: ______
- [ ] Project owner declares individual slices runtime COMPLETE only after the corresponding gates pass.

**Important:** Passing GitHub CI, Prisma migration or database advisor checks is **not** production runtime acceptance.
