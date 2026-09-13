# Wallet, Escrow and Settlement — Phase 13C

Status: IMPLEMENTED — CI/runtime validation pending
Updated: 2026-09-13

## Purpose

Phase 13C turns the Phase 13 ledger into a user-visible wallet projection and adds server-validated movement from held/pending funds into available balance.

The wallet is not a mutable balance row. It is derived from ledger postings.

## Wallet buckets

Per User + currency:

- `AVAILABLE` — eligible for withdrawal once Phase 13D payout is active.
- `PENDING` — Product proceeds received but not yet settlement-eligible.
- `ESCROW` — Service proceeds held against an active Booking.
- `PAYOUT_RESERVED` — funds reserved against an in-flight withdrawal.

Balance formula for a ledger account:

`credits - debits`

The browser never writes these balances.

## API

Authenticated wallet reads:

- `GET /api/v1/wallet`
- `GET /api/v1/wallet/transactions`

Server-validated release requests:

- `POST /api/v1/wallet/escrows/bookings/:bookingId/release`
- `POST /api/v1/wallet/settlements/orders/:orderId/release`

A release request is not itself financial authority. The server re-derives identity, transaction ownership, durable business state and durable financial state before posting money movement.

## Booking escrow release

Required state:

- caller is the Booking client
- Booking is `COMPLETED`
- matching EscrowRecord exists
- EscrowRecord is `HELD`

Ledger movement:

`Hustler ESCROW debit → Hustler AVAILABLE credit`

The transition is idempotent through:

`escrow:{escrowId}:released`

EscrowRecord becomes `RELEASED` and records `releasedAt`.

SystemEvent:

- `escrow.released`

Private Booking requirements are not included in the event payload.

## Product settlement release

Required state:

- caller is the Order seller
- Order is `COMPLETED`
- an authoritative applied successful PaymentAttempt exists
- the original payment capture ledger transaction exists

Ledger movement:

`Seller PENDING debit → Seller AVAILABLE credit`

The transition is idempotent through:

`order:{orderId}:settlement-released`

SystemEvent:

- `settlement.released`

The request cannot manufacture a paid/completed Order. Those states must already exist through their authoritative domains.

## Wallet web surface

`/wallet` now exposes:

- available balance
- pending balance
- escrow balance
- payout-reserved balance
- ledger-backed transaction history
- explicit balance authority (`LEDGER`)
- explicit client-writable flag (`false`)

Account links now include Wallet.

Withdrawal remains intentionally unavailable until Phase 13D.

## Security invariants

- no direct browser database access to financial tables
- no client-editable balance
- no release from incomplete transactions
- no release without matching authoritative payment/escrow evidence
- all consequential money movement has an idempotency key
- all movement is represented by balanced ledger postings
- release events contain IDs and non-sensitive financial metadata only

## Next

Phase 13D adds payout/withdrawal, authoritative refund and reconciliation workflows on top of these wallet buckets.
