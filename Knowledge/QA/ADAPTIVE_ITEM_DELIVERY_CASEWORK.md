# Adaptive Item Delivery Casework — review gate

**Status:** Proposed source branch only. No migration applied, feature activated, deployment, charge, payout, refund, escrow release or production database change.

## Why this exists
Adaptive item work already records provider-reported DELIVERED/COLLECTED and client physical-receipt acknowledgment. These are not equivalent. A customer reporting non-receipt needs a safe, auditable escalation path, without creating a second dispute ledger.

## Implemented contract
- A direct Client (never an invited workspace member or arbitrary Agent) may dispute **physical non-receipt** after the provider marks a canonical item Booking DELIVERED or COLLECTED, before the client has acknowledged physical receipt. The canonical Booking must still be FUNDED or IN_PROGRESS.
- In one database transaction, compare-and-set the Booking to DISPUTED, compare-and-set the item revision, create the unique existing **MarketplaceCase** (subjectType BOOKING, subjectId canonical Booking ID), append a typed immutable AdaptiveItemEvent, record an audit system event, and notify the Hustler in-app.
- Booking DISPUTED blocks the existing item receipt-confirmation path and canonical completion journey. No separate payment, refund, payout or escrow mutation is introduced; a case resolution alone does **not** clear DISPUTED or release money.
- Direct participants can read **only their case status and submitted participant statements**, not internal admin MarketplaceCaseNote entries. Each new statement requires the current item revision, creates an immutable event, and notifies the other participant.
- Existing admin MarketplaceCase detail conditionally includes these participant-authored event records when Adaptive Core is explicitly enabled. Admins retain the existing claim, review, assignment and resolution workflow; no parallel case console is introduced.
- The existing canonical Booking page shows a customer objection form or both parties' shared case timeline, with narrow optional reference metadata and explicit warnings that a submitted tracking/handover/message reference is **unverified**.
- The runtime remains behind the existing AuthGuard and **fail-closed** HUSTLE_ADAPTIVE_CORE_ENABLED feature guard. No reads of optional Adaptive tables are added to the ordinary Booking route while disabled.

## Deliberate limits
- Not a work-quality complaint or authorization to refund or release escrow.
- Does not provide photo/video uploads, courier authentication, GPS proofs, signatures, or third-party verification. Self-reported reference IDs are **not** proof. Add private evidence attachment integration only after reviewing existing media permissions, retention and secure upload boundaries.
- The existing MarketplaceCase unique Booking constraint allows at most one case for any Booking. If another kind of case already occupies that Booking, this UI directs users to support rather than overwriting or creating another ledger.
- A resolved/closed admin case does **not** automatically restore Booking payment/completion state. A separately authorized financial/transaction resolution is required.
- No agent/team permission is treated as sufficient to view the participants' private dispute statements.

## Tests and acceptance
- `scripts/qa/adaptive-core-structure.test.cjs` checks route/guard/canonical-case/financial boundaries and participant UI wiring.
- `scripts/qa/adaptive-core-db-smoke.cjs` now exercises two actual parties and an unrelated account against the disposable local PG17 database: delivery claim, single MarketplaceCase, booking DISPUTED, stale revision rejection, non-receipt confirmation blocked, both parties' typed statements and admin case evidence, and absence of new financial records.
- Run the existing Adaptive Core disposable database acceptance, Foundation CI (API production build, Next.js build/typecheck), isolated API acceptance, and other required repository checks on the **exact final commit**. Treat any failed/unrun check as a blocker, not as successful.
- Later test authenticated real iPhone/Android client and Hustler views in an explicitly enabled, isolated **migrated** environment before any production activation.

## Binding release boundary
Keep **draft** until current-head CI is green and the review establishes no conflicting existing Booking case. Founder review is necessary before merge. Production schema reconciliation, feature activation, actual payments/refunds, media/courier validation and deployment remain separately gated.
