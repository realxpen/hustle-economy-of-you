# ADR-0003 — Hustler Application Lifecycle

Status: Accepted
Date: 2026-09-07

## Context

Hustle uses one identity with progressive capabilities.

A Client becoming a Hustler must expand the capabilities of the existing User rather than create another account, mode or role context.

## Decision

Hustler eligibility is represented by `HustlerApplication`.

The MVP maintains one current Hustler application per User.

Application states:

- DRAFT
- SUBMITTED
- UNDER_REVIEW
- APPROVED
- REJECTED
- SUSPENDED

Verification state is represented separately.

Supporting evidence is represented by `HustlerApplicationProof`.

Approval is a server-side transaction that:

1. marks the application APPROVED;
2. creates or activates `UserCapability(HUSTLER, ACTIVE)`.

CLIENT is never removed.

Applicants cannot approve themselves.

## Consequences

This preserves one identity and separates workflow state from authorization.

The MVP intentionally does not yet model a complete immutable history of every application attempt.

## Phase boundary

This does not introduce a role switcher.

It does not create a separate Hustler account.

It does not implement the full Admin + Operations system.
