# Financial Web Experience — Phase 13E

Status: IMPLEMENTED — browser/runtime gate pending
Updated: 2026-09-13

## Purpose

Phase 13E exposes the Phase 13 financial system to users without moving financial authority into the browser.

The UI may request an operation and display durable status. It may never declare provider success, edit wallet balances, or manufacture `PAID`, `FUNDED`, `REFUNDED`, released escrow, or successful payout state.

## Wallet

Route:

`/wallet`

Surfaces:
- available balance
- pending balance
- escrow balance
- payout-reserved balance
- ledger transaction history
- withdrawal request form
- withdrawal history
- refund operation history
- reconciliation health

Wallet values are fetched from ledger-derived server read models.

## Payment experience

Reusable financial controls are embedded into Booking and Order detail pages.

Booking:
- CLIENT + `PAYMENT_PENDING` → initialize secure payment
- payment attempt status/recovery visible after refresh
- CLIENT + `FUNDED` → request eligible refund
- CLIENT + `COMPLETED` → release held escrow

Order:
- BUYER + `PENDING` → initialize secure payment
- payment attempt status/recovery visible after refresh
- BUYER + `PAID` → request eligible refund before fulfillment
- SELLER + `COMPLETED` → release pending settlement to available balance

A provider checkout URL is followed when an adapter supplies one. The sandbox adapter has no external checkout URL and therefore remains in a waiting-for-authoritative-confirmation state until its signed webhook arrives.

## Idempotency in the browser

Payment, refund and withdrawal requests use generated idempotency keys.

For retryable browser requests, keys are persisted in `sessionStorage` until the server acknowledges creation. This reduces the risk that a network interruption causes a second financial operation.

Server-side idempotency and unique constraints remain authoritative.

## Recovery/read endpoints

The browser recovers durable state through:
- latest payment by transaction subject
- payment attempt detail
- wallet projection
- ledger history
- withdrawal history
- refund history
- reconciliation report

Refreshing the UI does not lose financial state because the state lives in PostgreSQL/ledger records rather than component memory.

## UX principles

- show explicit states such as PENDING, PROCESSING, SUCCEEDED and FAILED
- distinguish transaction lifecycle from payment lifecycle
- distinguish held/pending funds from available funds
- explain that provider confirmation is authoritative
- preserve existing unified identity model; no seller/client wallet modes
- link transaction detail pages to one shared Wallet

## Production boundary

This UI is sandbox-capable, but production payment activation remains a separate risk/operations gate after the consolidated Phase 13 sandbox money test passes.
