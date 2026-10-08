# ADR-0044 — Assisted Registration Permission Correction and Claim Handoff

Status: Accepted
Date: 2026-10-08

## Context

Assisted registration captures permission scopes only during creation. Agents could forget a legitimate requested business permission but had no way to correct the recorded scopes afterward. Also, successful contact verification marked the provisional account CLAIMED without ending the original Agent relationship or revoking its grants.

## Decision

While an Agent-assisted Client is still unclaimed and the original relationship is ACTIVE, the assisting ACTIVE AGENT may update the optional delegated scopes **only after fresh explicit consent** from the person. The existing required onboarding/application scopes remain included until claim. Each change captures consent confirmation, method, optional note, previous/next scopes, and actor-vs-owner provenance in AgentDelegationAudit and SystemEvent. A permission update is rejected after claim or relationship revocation. Scope updates and claim serialize through the assisted-registration record.

Claiming the account with the same verified email/phone remains owner-controlled. In the same claim transaction, revoke the original assisted Agent relationship and all active grants. Keep the permanent User identity, Client/Hustler capabilities, application and proof history, Agent relationship history, and audit events. The Agent has no automatic continuing authority, including over profile, content, bookings, messages or applications. The newly authenticated owner may explicitly re-invite an Agent and select ongoing permissions.

For historical accounts CLAIMED before this rule was introduced, server-side delegated-action authorization denies active grants from the original pre-claim relationship unless the owner subsequently initiated a new Agent invitation after the claim.

This correction does not add a role switcher, Agent-owned identity, Agent-managed authentication, or authority over wallet, escrow, payouts, verified Reviews or reputation.

## Consequences

- Agents can correct genuinely consented scope selections for an unclaimed assisted identity.
- Claim is a clear owner-control handoff, not merely an authentication credential attachment.
- Server-side protections prevent stale historical grants from surviving the claim.
- New owner consent is required to maintain an ongoing professional representation arrangement.
- No Prisma schema migration is required.
- Production/runtime validation remains manual after project-owner deployment.
