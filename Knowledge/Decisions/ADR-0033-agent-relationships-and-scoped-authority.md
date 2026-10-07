# ADR-0033 — Agent Relationships and Scoped Delegated Authority

Status: Accepted
Date: 2026-10-07

## Context

Phase 18A established a verified `AGENT` capability on the unified Hustle identity, but intentionally granted no authority over another Hustler.

The next requirement is explicit representation: a Hustler may choose an approved Agent to assist with selected professional workflows. That authority must be revocable, scoped and attributable without transferring ownership.

## Decision

Phase 18B introduces an explicit `AgentRelationship` between one Hustler and one approved Agent.

Lifecycle:

`Hustler invite → PENDING → Agent accept → ACTIVE → either side ends → REVOKED`

An Agent may have multiple independent Hustler relationships.

The Hustler grants one or more named scopes:

- `PROFILE_MANAGE`
- `SERVICE_MANAGE`
- `PRODUCT_MANAGE`
- `CONTENT_MANAGE`
- `BOOKING_MANAGE`
- `CLIENT_MESSAGE_MANAGE`

A grant is not effective unless the relationship is ACTIVE, the owner still has ACTIVE HUSTLER capability, the actor still has ACTIVE AGENT capability, and the exact permission remains active.

Blocked users cannot create or activate an Agent relationship.

## Audit authority

`AgentDelegationAudit` records the relationship, actor, Hustler owner, action, optional permission scope and future entity context.

This preserves actor, owner, relationship and permission as separate concepts. Lifecycle changes are also emitted to `SystemEvent`.

## Critical boundary

Phase 18B does not modify existing owner-only Service, Product, Post, Booking or Messaging write paths.

Therefore an ACTIVE relationship with stored grants still exposes no operational business controls yet. A later delegated-action slice must integrate those paths with `assertAgentPermission` and action-level audit records.

No Agent relationship transfers or grants authority over login/identity ownership, wallet balances, ledger entries, escrow, payouts, verified Reviews, public reputation or private trust/safety evidence.

## Consequences

Hustle gains a trustworthy delegation primitive before any Agent can act on another Hustler's business.
