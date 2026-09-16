# ADR-0023 — Full Trust Experience

Status: Accepted
Date: 2026-09-16

## Context

Phase 14 now has multiple trust surfaces that deliberately serve different audiences and authority models:

- public verified provider reviews,
- private Hustler/Seller counterparty feedback,
- private user safety reports,
- user-controlled blocking,
- private Admin safety intelligence and human moderation.

Each subsystem has been validated independently. The final integration risk is UX ambiguity: a user must be able to understand which actions are public, which are private, what changes reputation, and what remains available after a block or moderation action.

## Decision

Phase 14E introduces a unified signed-in Trust Activity experience without merging the underlying authority models.

The account trust surface must:

1. show public reviews the user has given as a distinct public-reputation activity;
2. show private counterparty feedback separately and clearly label it private;
3. show the user's submitted safety reports with their moderation lifecycle status;
4. show users the account has blocked and allow deliberate unblocking;
5. state that private feedback, reports and blocks do not directly change public UserReputation;
6. preserve the existing server-authoritative transaction and participant checks;
7. preserve Admin-only safety intelligence as a separate internal surface;
8. avoid exposing private notes or moderation intelligence publicly;
9. keep block behavior reversible without deleting historical transaction or message evidence.

## UX consistency rules

- Public review language uses `TRUST · REVIEW` and `Verified transaction`.
- Private counterparty feedback uses `PRIVATE · TRUST & SAFETY`.
- Reports use `PRIVATE REPORT` and display the durable moderation status.
- Blocks use `CONTACT SAFETY` and explain that historical evidence is preserved.
- Private experience star selection is cumulative, matching the public star-control interaction model.
- Counterparty feedback issue selection is capped at the backend-supported maximum of eight categories.

## Consequences

- Users gain one place to understand their trust-related activity.
- Public reputation and private safety remain conceptually and technically separate.
- Existing trust APIs remain the source of truth; Phase 14E adds no client-manufactured trust state.
- Admin moderation remains inaccessible from the user trust activity surface.
