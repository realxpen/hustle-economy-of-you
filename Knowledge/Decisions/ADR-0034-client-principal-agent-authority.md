# ADR-0034 — Client Principal Can Appoint an Agent Before Hustler Activation

Status: Accepted
Date: 2026-10-07

## Context

Phase 18B originally required the relationship owner to hold ACTIVE HUSTLER capability before the **Manage Agents** surface or Agent relationship API was available.

That is too restrictive for Hustle's unified identity model.

Every user begins as CLIENT. An Agent may help a person organize their Hustle presence and eventually progress toward professional participation. Requiring HUSTLER before a user can appoint an Agent blocks that legitimate path and incorrectly makes representation a consequence of Hustler activation.

## Decision

The Agent relationship is between:

`ACTIVE CLIENT principal → approved ACTIVE AGENT`

Every normal Hustle identity already has CLIENT capability, so a signed-in Client may:

- open **Manage Agents**;
- invite an approved Agent;
- choose permission scopes;
- update those scopes;
- revoke the relationship.

The Agent must still explicitly accept before the relationship becomes ACTIVE.

The relationship does **not** manufacture HUSTLER capability.

## Capability boundary

Relationship authority and operational capability are separate.

An ACTIVE Client→Agent relationship may exist while the principal is CLIENT-only.

Future delegated operations must enforce both:

1. an ACTIVE Agent relationship with the exact named permission; and
2. whatever capability the underlying operation itself requires.

Examples:

- universal User content can rely on User-level content authority when delegated-content support is implemented;
- ProfessionalProfile / Services / Products / commerce hosting / Hustler-side Bookings still require the principal to hold ACTIVE HUSTLER;
- wallet, ledger, escrow, payouts, verified Reviews and reputation remain non-delegable.

Therefore `assertAgentPermission` validates relationship authority against an ACTIVE CLIENT principal. The downstream domain service remains responsible for enforcing HUSTLER when the requested action is Hustler-only.

## Data compatibility

The Prisma model exposes the relationship owner as `principalUserId` / `principal`.

The existing physical Postgres column remains `hustlerUserId` through Prisma `@map` for backward-compatible hosted data. No destructive database rename is required.

## Consequences

A newly created Hustle account can appoint and manage an Agent immediately.

The Agent relationship can precede Hustler activation without bypassing any Hustler-only business authority.
