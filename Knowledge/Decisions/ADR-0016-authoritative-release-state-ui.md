# ADR-0016 — Authoritative release state controls release actions

Status: Accepted
Date: 2026-09-15

## Decision

Booking escrow and Order settlement release controls must be driven by authoritative financial state, not only by transaction lifecycle status.

A `COMPLETED` Booking or Order does not by itself mean funds still need to be released. The UI must query the financial ledger/escrow read model and render the release action only while release remains outstanding.

## Rules

- Booking release state is derived from the canonical `EscrowRecord` for the Booking.
- Order settlement release state is derived from the idempotent settlement ledger transaction.
- Once release is authoritative, the release button disappears on refresh and the UI shows a durable `RELEASED` state.
- Release endpoints remain idempotent, but duplicate-safe backend behavior is not a reason to expose stale actions in the UI.
- Only transaction participants may read release state.

## API

`GET /api/v1/wallet/release-state/:subjectType/:subjectId`

Returns participant-scoped authoritative release status for `BOOKING` or `ORDER`.
