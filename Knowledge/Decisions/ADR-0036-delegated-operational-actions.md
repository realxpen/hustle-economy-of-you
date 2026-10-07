# ADR-0036 — Delegated Operational Actions and Agent Business Workspace

Status: Accepted
Date: 2026-10-07

## Context

Phase 18B created explicit Client-principal↔Agent relationships and named permission scopes.
Phase 18C added Agent-assisted onboarding and Hustler registration.

Until Phase 18D, those business scopes were stored authority only. They did not authorize real mutations on the represented person's Profile, Services, Products or Content.

## Decision

Phase 18D activates the first real delegated business operations through a dedicated Agent API and workspace.

The first operational scopes are:

- `PROFILE_MANAGE`
- `SERVICE_MANAGE`
- `PRODUCT_MANAGE`
- `CONTENT_MANAGE`

The Agent does not impersonate the principal and does not call the principal's owner-only routes.

Instead:

`Agent auth → ACTIVE relationship → exact scope check → underlying principal capability check → owner-scoped mutation → AgentDelegationAudit`

## Capability rules

Professional Profile, Services and Products require:

1. actor has ACTIVE AGENT;
2. relationship is ACTIVE;
3. exact delegated permission is ACTIVE;
4. neither party has blocked the other;
5. represented principal has ACTIVE HUSTLER.

Content requires:

1. actor has ACTIVE AGENT;
2. relationship is ACTIVE;
3. CONTENT_MANAGE is ACTIVE;
4. neither party has blocked the other;
5. represented principal retains ACTIVE CLIENT.

Content does not manufacture or require HUSTLER because Hustle content authority is User-level.

## Ownership

All delegated entities continue to belong to the principal.

- ProfessionalProfile.userId remains the principal.
- Service/Product professionalProfileId remains the principal's profile.
- Post professionalProfileId remains the principal's content profile.
- public storefront/reputation ownership is unchanged.

The Agent is recorded only as the actor.

## Audit

Every delegated mutation writes both:

- `AgentDelegationAudit` with relationship, Agent actor, principal owner, exact permission scope, action and entity;
- `SystemEvent` with the same actor/owner boundary for operational observability.

Permission revocation or relationship revocation immediately blocks subsequent delegated writes because every action re-checks authority server-side.

## Dedicated API

Delegated business mutations use `/agent-business/:principalUserId/*`.

Existing owner routes remain unchanged and continue to authorize the signed-in owner only.

This avoids weakening owner authorization or pretending the Agent is the principal.

## First-slice surface

Included:
- Professional Profile read/save/publish/unpublish
- Service list/create/save/publish/pause/delete
- Product list/create/save/publish/pause/delete
- Content list/create/save/media add/remove/publish/archive
- Agent Business Workspace reachable from each active representation

Not included:
- Bookings
- Client Messages
- wallet
- ledger
- escrow
- payouts
- Reviews
- reputation
- login or identity ownership

Bookings and Client Messages should follow only after this first delegated operational slice passes runtime acceptance.
