# Hustle — Consolidated Production Runtime Acceptance (18D–19E)
**Target session:** 2026-10-08 (or next manual validation session)
**Slices:** 18D, 18E, 19A, 19B, 19C, 19D, 19E
**Status:** Phase 18D COMPLETE — all section A checks confirmed passing in production by the project owner on 2026-10-08; Phase 18E PARTIAL (previous Booking and Messaging checks plus unrelated-principal isolation and BOOKING_MANAGE revocation denial passed; blocked-conversation enforcement passed; only safe funded start pending; stored message attribution and Agent suspension passed owner testing); Phase 19A COMPLETE (all six section C checks passed in production, owner-confirmed 2026-10-09); Phases 19B–19E PENDING. Evidence is owner-reported runtime testing; no automated test output or screenshots attached to this checklist.

## Before testing
1. Manually deploy the latest `main` to **API + Web + Admin**. Vercel auto-deploy remains disabled. ChatGPT must not deploy.
2. Confirm the Phase 18E message provenance and Phase 19C casework migrations were applied to the connected Supabase database.
3. Prepare distinct signed-in **Admin**, **ACTIVE AGENT**, **ACTIVE HUSTLER**, and **CLIENT-only** test identities. Keep admin reviewer separate from applicants.
4. Use disposable content, services, products, messages and transaction examples. **Do not trigger real escrow release/refund/payout** as part of this test.
5. Record actual errors/screenshots and the date/commit of deployment.

## A — 18D Delegated Profile / Service / Product / Content
- [x] With a valid ACTIVE Agent relationship and PROFILE_MANAGE, Agent edits/publishes a represented Hustler profile. Owner remains Hustler; Agent appears only as audited actor.
- [x] With SERVICE_MANAGE, Agent creates/edits/publishes/pauses a Service owned by that Hustler.
- [x] With PRODUCT_MANAGE, Agent creates/edits/publishes/pauses a Product owned by that Hustler.
- [x] With CONTENT_MANAGE, Agent creates/edits/media-attaches/publishes a Post owned by the principal.
- [x] CLIENT-only principal can delegate Content, but not professional Profile/Service/Product operations.
- [x] Removing one grant immediately blocks the corresponding mutation. No Agent can act for an unrelated principal.
- [x] Delegated mutations create AgentDelegationAudit + SystemEvent and do not alter wallet/reputation.


**18D sign-off (2026-10-08):** Project owner confirmed the previously pending Product Management, Content/Posts, capability boundaries and audit checks all passed, following previously accepted Profile and Service flows. Mark 18D runtime COMPLETE. All non-18D sections remain pending independent testing.

## B — 18E Delegated Bookings / Client Messages
- [x] Agent with BOOKING_MANAGE can list/read only represented Hustler Bookings.
- [x] Agent accepts a REQUESTED Booking; schedule conflicts remain blocked.
- [x] Agent declines a separate disposable REQUESTED Booking; can cancel an ACCEPTED / PAYMENT_PENDING Booking before funding.
- [x] Free ACCEPTED work can be started on a disposable test booking.
- [ ] Paid FUNDED work can be started in a safe sandbox/test-mode fixture. **Never use real funds for test fixtures.**
- [x] Agent **cannot** complete a Booking, refund, release escrow, change wallet/payout state or manipulate Reviews.
- [x] With CLIENT_MESSAGE_MANAGE, Agent reads the represented principal's existing direct conversations and sends a text reply.
- [x] Recipient **and principal** see Agent-assisted attribution.
- [x] Verify the Agent is recorded server-side in Message.delegatedByAgentUserId (separate from UI attribution).
- [x] Agent reading alone does not clear the principal's unread indicator.
- [x] Blocked conversations continue to deny delegated read/reply as required by UserBlock policy.
- [x] Revoking CLIENT_MESSAGE_MANAGE immediately blocks delegated conversation access and replies.
- [x] Revoking BOOKING_MANAGE immediately blocks delegated Booking access and mutation.
- [x] Suspending the Agent capability immediately blocks all delegated actions; reactivation restores otherwise authorized access.
- [x] Ordinary nondelegated messaging still sends and displays normally.

**18E partial acceptance (2026-10-08):** Project owner reports that the Agent could view a represented Hustler's booking, accept a REQUESTED Booking, retain principal ownership, and was blocked from accepting a conflicting Booking. Unrelated-principal Booking isolation was subsequently tested and passed. Booking decline, pre-funding cancellation, free-work start, and forbidden financial/completion/reputation actions were subsequently confirmed passing by the owner on 2026-10-08. Owner subsequently confirmed (2026-10-08) that delegated Message read/reply, recipient/principal Agent attribution, preserved owner unread state, immediate CLIENT_MESSAGE_MANAGE revocation denial and ordinary messaging passed. Further owner-confirmed 2026-10-08: Agent with access to Hustler A could not view or mutate Hustler B's Bookings, and revoking BOOKING_MANAGE immediately blocked Hustler A's Booking operations. Owner additionally confirmed 2026-10-08 that a represented account's UserBlock policy prevents delegated read/reply on blocked conversations. Owner confirmed on 2026-10-09 that server-side `delegatedByAgentUserId` attribution and Agent suspension/reactivation access controls also passed. Only isolated sandbox-funded Booking start is pending; do not simulate successful payments in production.

## C — 19A Admin Marketplace Operations
- [x] Admin console root loads overview metrics using AdminGuard; unauthorized account is denied.
- [x] User search by username/name/email/ID shows capability state without allowing edits in read surfaces.
- [x] Hustler and Agent application queues, Bookings, Orders and financial summaries load.
- [x] Audit events load and show correct actor, event and timestamps.
- [x] Booking/Order filters work and reflect canonical statuses; finance remains read-only.
- [x] Existing Trust & Safety console at `/trust-safety` remains accessible to authorized admins.

**19A partial sign-off (2026-10-09):** After manually deploying Admin at main `58b3156`, the project owner confirmed conventional Admin login, reload persistence, all six Admin routes, non-Admin denial, sign-out and primary Marketplace Operations datasets. User search by username, display name, email and User ID; capability visibility; unchanged read-only user details; and audit event actor/event/time display were separately confirmed passing by the owner on 2026-10-09. Owner additionally confirmed on 2026-10-09 that Booking and Order status filters return correctly filtered records and that financial state is read-only, with no payment confirmation, escrow release, refund or payout execution available in Phase 19A views. All Phase 19A checks passed; runtime COMPLETE.

## D — 19B Capability / Application Operations
- [x] Admin opens `/applications` and reviews an eligible Hustler application: start, secure proof preview, verification and approve.
- [ ] Admin opens a separate Agent application: start, verify, approve; assigned reviewer rules and self-review prohibition hold.
- [ ] Rejection cannot proceed without a reason. Approval cannot proceed without VERIFIED identity and proof.
- [ ] Using a disposable test account, Admin suspends HUSTLER or AGENT with mandatory reason.
- [ ] Corresponding approved application mirrors SUSPENDED; CLIENT remains ACTIVE; original review notes are preserved.
- [ ] Suspended Agent/Hustler loses protected mutation authority, but relationship history is not deleted.
- [ ] Admin reactivates the test capability with a required reason; status returns ACTIVE/APPROVED; audit records actor/target/reason.
- [ ] No CLIENT-ban, permanent revocation, money or reputation mutations appear.

**19B partial acceptance (2026-10-09):** Project owner confirmed the Hustler application review workflow passed: queue visibility, review initiation, secure proof preview, verification checks and approval of an eligible verified Hustler application. Independent Agent application approval, negative-path self-review/approval rejection, rejection-reason enforcement and suspension/reactivation integrity remain pending.

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

## G — 19E Enforcement Appeals & Restoration
- [ ] A user with no active restriction sees no appealable enforcement target.
- [ ] A user with a disposable held Post/Service/Product sees the exact current HOLD reason and can submit one appeal.
- [ ] A user with a disposable suspended HUSTLER or AGENT capability sees that current suspension and can submit one appeal.
- [ ] A second appeal against the same enforcementRef is rejected; a later distinct enforcement event can be appealed separately.
- [ ] The original enforcing admin cannot claim/review their own enforcement appeal.
- [ ] The appellant cannot review their own appeal even if their account is admin-authorized.
- [ ] A different admin claims SUBMITTED → UNDER_REVIEW and sees original enforcement reason, appellant reason, current restriction state and actors.
- [ ] UPHELD records a mandatory decision reason and leaves the restriction unchanged.
- [ ] OVERTURNED content appeal releases only that exact current hold; content remains ARCHIVED/PAUSED and is not auto-published.
- [ ] OVERTURNED capability appeal reactivates only the appealed HUSTLER/AGENT capability through the existing reactivation path.
- [ ] If newer enforcement exists after the appealed action, the older appeal cannot remove the newer restriction.
- [ ] Assigned reviewer can close DECIDED → CLOSED; original enforcement and appeal history remain visible.
- [ ] Appeal lifecycle emits submitted/review_started/decided/closed SystemEvents.
- [ ] Direct anon/authenticated DB access to EnforcementAppeal is denied; hustle_api has server-only SELECT/INSERT/UPDATE and no delete endpoint is exposed.
- [ ] Appeals do not mutate Booking/Order/payment/escrow/payout/Review/reputation/MarketplaceCase/SafetyReport state.
- [ ] Normal moderation release, capability suspension/reactivation, Account and Admin Operations still work after appeal integration.

## Final sign-off
- [ ] API deployment SHA: ______
- [ ] Web deployment SHA: ______
- [ ] Admin deployment SHA: ______
- [ ] Validation date and testers: ______
- [ ] Failed cases / screenshots: ______
- [ ] Regression retest after any fix: ______
- [ ] Project owner declares individual slices runtime COMPLETE only after the corresponding gates pass.

**Important:** Passing GitHub CI, Prisma migration or database advisor checks is **not** production runtime acceptance.
