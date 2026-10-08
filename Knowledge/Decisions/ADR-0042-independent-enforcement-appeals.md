# ADR-0042 — Independent Enforcement Appeals and Controlled Restoration

Status: Accepted
Date: 2026-10-08

## Context

Phase 19B introduced reversible HUSTLER/AGENT capability suspension. Phase 19D introduced reversible item-level content holds.

Those enforcement systems preserve audit history, but they are one-directional unless the affected user has a formal path to challenge a specific enforcement decision.

An appeal must not erase the original action, silently replace the moderation record, allow repeated submissions for the same decision, or give the reviewer authority over money/reputation.

## Decision

Phase 19E adds a first-class `EnforcementAppeal` workflow.

Appealable action types:

- `CONTENT_HOLD` — references an immutable MarketplaceModerationAction HOLD record.
- `CAPABILITY_SUSPENSION` — references the exact durable `admin.capability.suspended` SystemEvent.

Each appeal references one exact enforcement event through `enforcementRef`, which is unique in the appeal table.

Lifecycle:

`SUBMITTED → UNDER_REVIEW → DECIDED → CLOSED`

Decision:

- `UPHELD` — original restriction remains.
- `OVERTURNED` — restores only the exact appealed restriction through the existing controlled release/reactivation path.

## Eligibility

Only the affected user may submit an appeal.

The restriction must still be active and the referenced enforcement must still be the current action for that target.

Content:
- content must still be HELD;
- appellant must own the Post/Service/Product;
- enforcementRef must be the latest moderation action for that item and must be HOLD.

Capability:
- HUSTLER or AGENT capability must still be SUSPENDED;
- appellant must be the capability owner;
- enforcementRef must be the latest matching suspension SystemEvent.

One enforcement event may have only one appeal.

This prevents repeated appeals against one decision while still allowing a later, distinct enforcement event to be appealed separately.

## Independent review

An admin may claim a SUBMITTED appeal only when:

- they are not the appellant;
- they are not the admin recorded as the original enforcement actor.

Claiming assigns the appeal and moves it to UNDER_REVIEW.

Only that assigned independent reviewer may make the final decision or close the appeal.

## Controlled overturn

An OVERTURNED decision may restore the restriction only when the appealed enforcement is still current.

If newer enforcement exists, the older appeal cannot undo it.

Content:
- uses the existing moderation RELEASE path;
- the content remains ARCHIVED/PAUSED after release;
- nothing is automatically republished.

Capability:
- uses the existing HUSTLER/AGENT reactivation path;
- corresponding application state returns from SUSPENDED to APPROVED;
- existing relationships/history are retained.

If the restriction has already been independently restored, the appeal can still be recorded as overturned without applying a duplicate restoration.

## Audit

Events:

- `enforcement_appeal.submitted`
- `enforcement_appeal.review_started`
- `enforcement_appeal.decided`
- `enforcement_appeal.closed`

Original moderation/capability audit records remain immutable and are never replaced.

Appeal records themselves are server-managed, RLS protected, inaccessible directly to browser database roles, and have no deletion endpoint.

## Explicit non-authority

Appeals do not:

- cancel or alter Bookings or Orders;
- confirm payment;
- release/refund escrow;
- initiate payout;
- edit verified Reviews or UserReputation;
- automatically resolve MarketplaceCase;
- automatically change SafetyReport state;
- grant CLIENT suspension/ban authority.

## UI

User:
- `/appeals` from Account;
- shows currently appealable restrictions and appeal history.

Admin:
- `/appeals` in Admin Console;
- queue, independent claim, comparison of original enforcement vs appeal reason, decision and close.

## Future expansion

Formal deadlines, evidence uploads, party notifications, appeal escalation panels, Story/Live enforcement appeals and external compliance workflows are follow-on decisions.
