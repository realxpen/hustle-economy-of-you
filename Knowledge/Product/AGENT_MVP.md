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
