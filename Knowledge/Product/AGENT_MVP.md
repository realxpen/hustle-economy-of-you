# Phase 18 — Agent MVP

## Purpose

Agent is an approved progressive capability on the same Hustle identity.

The capability progression remains:

`CLIENT → optional HUSTLER → optional AGENT`

There are no separate Agent accounts, Agent profiles or role-switching modes.

## Phase 18A — Verified Agent Capability Foundation

Phase 18A establishes who is allowed to become an Agent before any delegated authority exists.

Flow:

`Existing Hustle User → Agent application → Admin review → Identity verification → Approval → AGENT ACTIVE`

Required application foundation:

- motivation;
- relevant representation / community / business-support experience;
- operating area;
- at least one private proof item.

Optional context:

- organization name;
- organization information.

Proof is private application evidence and is not public profile content.

## Approval invariant

Approval must atomically:

1. mark the Agent application `APPROVED`;
2. create or reactivate `UserCapability(AGENT, ACTIVE)`;
3. preserve the existing `CLIENT` capability;
4. preserve any existing `HUSTLER` capability;
5. record the consequential review/approval action in the system event trail.

Applicants cannot approve themselves.

Admin authority is required for Phase 18A approval.

## Critical boundary

`AGENT ACTIVE` means only:

> This unified Hustle identity is approved to participate as an Agent.

It does **not** mean the Agent has authority over any Hustler.

Phase 18A creates no Hustler↔Agent relationship and grants no delegated write access.

An approved Agent must not automatically gain access to another Hustler's:

- identity or login;
- ProfessionalProfile;
- Services or Products;
- Posts or portfolio;
- messages;
- bookings or schedules;
- wallet;
- ledger or escrow;
- payouts;
- reviews;
- public reputation;
- private trust/safety data.

## Next slice — Phase 18B

Phase 18B should introduce the explicit delegated-authority model:

`Hustler → Agent relationship → Hustler grants named permissions → Agent acts within grant`

The data model must distinguish:

- **actor** — who performed the action;
- **subject / business owner** — whose Hustle entity the action belongs to;
- **permission** — what the Agent was allowed to do;
- **relationship** — which Hustler granted that permission;
- **audit event** — when and how the delegated action occurred.

Relationships must be revocable and permission-scoped.

An Agent may eventually represent multiple Hustlers, but every represented Hustler must have an explicit relationship.

## Gate

**CLOSED — runtime validated 2026-10-07.**

A real existing Hustle user successfully:

1. applied for Agent;
2. saved the draft and uploaded private proof;
3. submitted the application;
4. appeared in the internal Agent review queue for a different authorized admin identity;
5. had the private proof opened through the signed preview flow;
6. passed identity verification;
7. was approved;
8. refreshed the unified account and saw `AGENT · ACTIVE` while the previous capabilities remained unchanged.

The approved application state rendered correctly, and no delegated access to another Hustler was available.

That absence is intentional. Phase 18A establishes verified Agent capability only; Phase 18B owns Hustler↔Agent relationships and permission grants.


## Phase 18B — Hustler↔Agent Relationship + Scoped Permission Grants

Phase 18B introduces explicit representation authority after Agent verification.

Flow:

`ACTIVE HUSTLER → invite ACTIVE AGENT + choose scopes → Agent accepts → ACTIVE relationship`

Named scopes:

- Professional profile
- Services
- Products
- Content
- Bookings
- Client messages

Rules:

- the Hustler initiates the invitation;
- the Agent must explicitly accept;
- blocked users cannot create or activate a relationship;
- one Agent may represent multiple Hustlers through separate relationships;
- permissions are relationship-specific and can be changed by the Hustler;
- the Hustler may revoke a pending or active relationship;
- the Agent may leave an active relationship;
- lifecycle and permission changes preserve actor vs Hustler-owner in `AgentDelegationAudit`.

Phase 18B deliberately does **not** wire the grants into owner-only Service/Product/Post/Booking/Messaging mutations yet. It establishes the authorization root those later delegated actions must enforce.

Financial and reputation authority remains non-delegable in this phase.


## Phase 18B authority correction — Client principal first

A user does **not** need to become a Hustler before appointing or managing an Agent.

Correct relationship root:

`ACTIVE CLIENT principal → invite ACTIVE AGENT → Agent accepts → ACTIVE relationship`

The relationship is identity-level delegation. It may exist before the principal activates HUSTLER.

Hustler capability is checked later by the specific delegated action when the underlying operation is Hustler-only. The relationship alone never creates or implies HUSTLER capability.

The web **Manage Agents** entry is therefore available to every signed-in Hustle Client identity.


## Phase 18C — Agent-Assisted Onboarding & Hustler Registration

Agents are not limited to managing already-active Hustlers.

An ACTIVE Agent may help a person who is not comfortable with technology join Hustle from the Agent's own device.

Flow:

`person consents → Agent creates assisted CLIENT identity → Agent helps with onboarding → Agent prepares/submits Hustler application → admin review → person may later claim the same identity`

Rules:

- no separate phone/device is required for the person during assisted registration;
- the person starts as CLIENT, not automatically as HUSTLER;
- the Agent must record explicit consent;
- the Agent never creates or knows the person's password;
- the assisted person remains the principal/owner;
- the Agent is always recorded as actor;
- the Agent receives onboarding-specific scopes for account setup and Hustler-application management;
- admin review remains independent and sees assisted-registration provenance;
- when the person later authenticates with a uniquely matching verified email/phone, the same identity is claimed rather than duplicated;
- wallet, escrow, payouts, Reviews and reputation remain non-delegable.

Canonical decision: `Knowledge/Decisions/ADR-0035-agent-assisted-onboarding.md`.


## Phase 18D — Delegated Operational Actions & Agent Business Workspace

Phase 18D turns stored permission grants into real, server-enforced delegated actions.

First operational surfaces:

- `PROFILE_MANAGE` → Professional Profile
- `SERVICE_MANAGE` → Services
- `PRODUCT_MANAGE` → Products
- `CONTENT_MANAGE` → Posts/content

Rules:

- every action re-checks ACTIVE AGENT, ACTIVE relationship, exact permission and block state;
- Profile/Services/Products additionally require the principal to be ACTIVE HUSTLER;
- Content remains User-level and requires only the principal's ACTIVE CLIENT identity;
- Agent never uses the principal's owner-only endpoints;
- every mutation records Agent actor vs principal owner in `AgentDelegationAudit`;
- revocation immediately blocks future delegated writes;
- Bookings and Client Messages remain outside this first 18D slice;
- wallet, ledger, escrow, payouts, Reviews and reputation remain non-delegable.

Canonical decision: `Knowledge/Decisions/ADR-0036-delegated-operational-actions.md`.


## Phase 18E — Delegated Bookings + Client Messages

Phase 18E extends delegated operations into customer handling without crossing into financial or reputation authority.

`BOOKING_MANAGE` may:
- read represented Hustler Bookings;
- accept/confirm a requested schedule;
- decline a request;
- cancel only before funding;
- start work after the canonical funding/status prerequisites are satisfied.

It may **not**:
- complete a Booking;
- fund/refund/release escrow;
- access wallet/ledger/payout authority;
- create or change Reviews/reputation.

`CLIENT_MESSAGE_MANAGE` may:
- read the represented principal's existing direct threads;
- read message history;
- send text replies on behalf of the principal.

Delegated messages preserve the principal as canonical sender while storing `delegatedByAgentUserId` and rendering visible Agent provenance. Agent reads do not silently clear the principal's unread state.

Canonical decision: `Knowledge/Decisions/ADR-0037-delegated-bookings-and-messages.md`.


## Authority correction — represented Client onboarding + review integrity

The Phase 18C onboarding permissions apply to **every represented ACTIVE CLIENT**, not only identities originally created through Agent-assisted registration.

For an ordinary existing Client:

`CLIENT grants onboarding/application scope → AGENT accepts → Agent may maintain basic identity details and prepare/submit Hustler application → Admin independently reviews → HUSTLER may be activated`

`ACCOUNT_ONBOARDING_MANAGE` may change basic identity/profile details such as display name, username, location, bio and avatar. It does not grant authentication ownership and must never allow the Agent to change the Client's email, phone, password, auth subject or verification state.

`HUSTLER_APPLICATION_MANAGE` may create/update the Client's DRAFT Hustler application, attach Agent-uploaded private proof and submit it. It never grants approval or HUSTLER activation. Admin review shows delegated submission provenance.

For Agent-assisted registrations, the provisional Hustle identity has no Agent-created password. The person claims it later using the same recorded contact:

- email: normal Hustle account creation with that exact email, a password chosen by the person, then email verification;
- phone: normal phone OTP using that exact number, with no password.

The verified contact claim preserves the existing Hustle User ID and history.

An Agent may legitimately buy from or book a represented Hustler. That transaction remains valid. However, public verified reputation must be independent: once the pair has had ACTIVE Client↔Agent representation, neither side may create a public provider reputation Review for the other from a Booking or Order, including after revocation. This prevents related-party and revoke-then-review reputation gaming.

Canonical decision: `Knowledge/Decisions/ADR-0043-agent-principal-onboarding-and-related-party-review-integrity.md`.
