# ADR-0032 — Agent Capability Foundation

Status: Accepted
Date: 2026-10-07

## Context

Hustle's Progressive Capability Model uses one User identity. CLIENT is foundational and HUSTLER/AGENT are additive capabilities.

Agent is consequential because future Agent functionality can allow one person to assist another professional with profile, content, Service, Booking and communication workflows.

If delegation is implemented before Agent identity and approval authority are established, Hustle risks creating ambiguous or excessive access.

## Decision

Phase 18 begins with a dedicated `AgentApplication` lifecycle on the existing User.

Statuses:

- DRAFT
- SUBMITTED
- UNDER_REVIEW
- APPROVED
- REJECTED
- SUSPENDED

Identity verification remains separate from application state.

Agent application proof is stored privately.

Phase 18A review is protected by Hustle admin authorization.

Approval is a server-side transaction that:

1. requires an ACTIVE CLIENT capability;
2. marks the application APPROVED;
3. creates or reactivates `UserCapability(AGENT, ACTIVE)`;
4. preserves all existing capabilities;
5. records an audit-oriented SystemEvent.

Applicants cannot review their own application.

## Delegation boundary

Approval of AGENT does not create a Hustler↔Agent relationship.

It does not authorize access to another User, ProfessionalProfile, Service, Product, Post, Conversation, Booking, financial account, Review or reputation projection.

Delegated authority must be introduced separately through explicit Hustler-granted relationships and scoped permissions.

The future delegation model must preserve the difference between:

- the Agent who performs an action;
- the Hustler/business that owns the affected entity.

## Consequences

Phase 18A provides a trustworthy authorization root for future Agent functionality without prematurely broadening access.

Phase 18B can build delegated relationships on top of an already verified `AGENT` capability.

No wallet, escrow, payout, review or reputation authority is changed by this decision.
