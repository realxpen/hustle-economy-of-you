# ADR-0022 — Explainable Admin Safety Intelligence

Status: Accepted
Date: 2026-09-15

## Context

Hustle now has four distinct trust/safety evidence sources:

- public verified provider reviews,
- private Hustler/Seller counterparty feedback,
- user safety reports from Booking, Order, Profile and Conversation contexts,
- authoritative platform behaviour such as cancellations, disputes, refunds and blocks.

These signals have different evidentiary weight. A subjective report or private rating must not be treated as equivalent to authoritative platform state, and one complaint must not automatically penalize a user.

## Decision

Phase 14D-D introduces an Admin-only safety intelligence layer that organizes durable evidence for human review.

The Admin read model must:

1. keep public UserReputation separate from private safety intelligence;
2. expose report counts, statuses, categories, contexts and independent-reporter counts;
3. expose private counterparty feedback patterns such as would-work-again and issue categories;
4. expose authoritative transaction outcomes separately from subjective signals;
5. expose block counts as subjective corroborating context, not proof;
6. generate only explainable indicators with a human-readable explanation and exact evidence payload;
7. never produce an opaque automatic risk score;
8. never trigger punitive user state from a single report or feedback item;
9. require human moderation to transition reports to ACTIONED or DISMISSED;
10. record Admin moderation transitions as SystemEvents for auditability.

## Admin authorization

During the MVP bootstrap stage, internal Admin API access is protected by normal Supabase authentication plus a server-only `HUSTLE_ADMIN_USER_IDS` allowlist containing canonical Hustle User IDs.

This is intentionally separate from Client/Hustler/Agent product capability switching. The allowlist is a bootstrap authorization boundary, not a user-facing role switcher. A later dedicated Admin invitation/access-management system may replace this bootstrap mechanism without changing the safety-intelligence contracts.

## Indicator policy

Examples of explainable indicators include:

- multiple independent reporters,
- repeated negative transaction-backed counterparty feedback,
- a serious unresolved allegation requiring human review,
- repeated self-initiated Booking cancellations,
- repeated authoritative dispute/refund outcomes,
- multiple independent blocks received.

Each indicator states what evidence caused it. Indicators are review aids only.

## Consequences

- Public provider reputation remains untouched by moderation signals.
- Admins can inspect why a user has been surfaced for review.
- Subjective and objective evidence remain distinguishable.
- Moderation outcomes are auditable.
- The MVP avoids accidental automated punishment and opaque trust scoring.
