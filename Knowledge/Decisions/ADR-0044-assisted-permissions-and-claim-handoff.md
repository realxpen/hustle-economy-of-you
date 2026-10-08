# ADR-0044 — Assisted Registration Permission Correction and Claim Handoff

Status: Accepted
Date: 2026-10-08

## Context

Assisted registration captures permission scopes only during creation. Agents could forget a legitimate requested business permission but had no way to correct recorded scopes afterward.

An Agent's permission to change scopes during assisted onboarding must be temporary: after the principal claims the account, only the newly authenticated owner may edit or revoke permissions. Ongoing representation already consented to at registration should not be silently cancelled merely because the owner claims their account.

## Decision

While an Agent-assisted Client is still unclaimed and the original relationship is ACTIVE, the assisting ACTIVE AGENT may correct optional delegated scopes **only after fresh explicit consent** from the person. The existing two required onboarding/application scopes remain included at initial registration. Each change captures consent confirmation, method, optional note, previous/next scopes, Agent actor vs owner, and a durable AgentDelegationAudit and SystemEvent.

Scope changes through the assisted-registration endpoint are rejected when the identity becomes CLAIMED or the relationship is no longer ACTIVE, even if the owner later reauthorizes the Agent through ordinary delegation. The assisted-registration details and mutation surfaces close on claim; the Agent's history retains only non-sensitive summary data. The claimed owner retains the original Hustle User ID, capabilities, application and proof history, and the existing Agent relationship/audit history.

**Only the provisional Agent's ability to self-select or change permission scopes expires at claim.** Previously consented scopes remain on the relationship. From that moment, only the authenticated principal may update or revoke them from Manage Agents. No special Agent permission for changing their own grants survives claim.

Any normal delegated action after claim still requires an ACTIVE relationship and its exact permission on the server, including applicable Client/Hustler capability checks and hard exclusions for auth, wallet, ledger, escrow, payouts, verified Reviews and reputation.

## Consequences

- Agents can correct omitted scopes for an unclaimed assisted identity with the person's fresh consent.
- Claim hands permission management to the owner without accidentally disrupting legitimate Agent representation.
- The assisted onboarding surface no longer exposes the person's private details after claim.
- The owner can immediately change permissions or revoke the entire Agent relationship.
- No role switcher or separate Agent-owned identity is introduced.
- No Prisma schema migration is required.
- Production/runtime acceptance is separate from implementation and remains owner-controlled.
