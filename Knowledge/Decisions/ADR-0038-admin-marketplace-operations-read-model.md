# ADR-0038 — Admin Marketplace Operations Read Model

Status: Accepted
Date: 2026-10-07

## Context

Hustle already has separate internal surfaces for capability review and a standalone Trust & Safety console.

The Phase 19 MVP goal is broader: the operating team must understand and run the marketplace without querying PostgreSQL manually.

Immediately exposing mutation controls for suspensions, payments, escrow, refunds or payouts would combine visibility and high-risk authority too early.

## Decision

Phase 19A establishes a unified, read-oriented Admin Operations control plane.

All operations endpoints live under:

`/admin/operations/*`

and require:

`AuthGuard + AdminGuard`

using the existing server-side `HUSTLE_ADMIN_USER_IDS` allowlist.

The read model includes:

- marketplace overview counts;
- user/capability search and user operational detail;
- pending Hustler and Agent application queues;
- Booking state;
- Order state;
- PaymentAttempt state;
- escrow state;
- payout state;
- refund state;
- durable SystemEvent audit history;
- links into the existing Trust & Safety console.

## Admin app structure

The standalone admin application root becomes the Marketplace Operations cockpit.

Existing Trust & Safety functionality is preserved at:

`/trust-safety`

Both use the same tab-session bearer token handling already used by the internal admin app.

## Read-first boundary

Phase 19A does not expose write controls for:

- capability activation/suspension;
- user suspension;
- Booking/Order mutation;
- payment confirmation;
- escrow release/refund;
- payout execution;
- Review/reputation mutation.

Existing, already-authorized human moderation actions remain available in the Trust & Safety console.

Capability application approval remains on the existing internal Hustle web review surfaces until a later Admin Operations slice deliberately migrates those actions.

## Sensitive financial data

The operations financial snapshot exposes state necessary for support and reconciliation but does not return stored provider metadata blobs, API secrets or credentials.

## Consequences

The team gains one authoritative operating view without needing direct database access.

High-risk marketplace mutations can be introduced later behind explicit action-specific policies and audit requirements instead of being bundled into the initial dashboard.
