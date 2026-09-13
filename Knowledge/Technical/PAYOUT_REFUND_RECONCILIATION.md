# Payout, Refund and Reconciliation — Phase 13D

Status: IMPLEMENTED — sandbox runtime gate pending
Updated: 2026-09-13

## Purpose

Phase 13D completes the server-authoritative money lifecycle after payment collection and settlement. It adds withdrawal reservation, provider-confirmed payout, provider-confirmed refund, compensating ledger entries, and explicit reconciliation reporting.

## Withdrawal / payout

Authenticated users may request withdrawal only from ledger-derived `AVAILABLE` balance.

Request flow:

`AVAILABLE → reserve → PAYOUT_RESERVED → provider confirmation → payout success`

Rules:
- `Idempotency-Key` is required.
- requested amount must be a positive integer in minor units.
- currency is explicit and normalized server-side.
- available balance is checked inside a serializable database transaction.
- reservation posts `AVAILABLE` debit and `PAYOUT_RESERVED` credit.
- payout remains `PROCESSING` until a signed provider event arrives.
- browser/API request alone never marks payout successful.

Signed payout success:
- `PAYOUT_RESERVED` debit
- provider-clearing credit
- Payout becomes `SUCCEEDED`
- `payout.confirmed` observation

Signed payout failure:
- `PAYOUT_RESERVED` debit
- `AVAILABLE` credit
- Payout becomes `FAILED`
- funds are restored
- `payout.failed` observation

Duplicate and stale provider events are idempotent/ignored safely.

## Refund

Refund amount, currency, payment reference, payer and beneficiary are derived from the applied successful PaymentAttempt. The client does not submit an arbitrary refund amount.

Current MVP is full-refund only.

BOOKING refund eligibility:
- requester is original payer/client
- Booking is `FUNDED` or `DISPUTED`
- matching escrow is `HELD`
- request moves escrow to `REFUND_PENDING`

ORDER refund eligibility:
- requester is original payer/buyer
- Order is still `PAID`
- refund is blocked after fulfillment has advanced

Signed refund success:
- domain receives server-only authoritative `REFUNDED` transition
- Booking escrow becomes `REFUNDED`, or Order inventory is restored exactly once
- beneficiary financial bucket is debited
- provider-clearing account is credited
- Refund becomes `SUCCEEDED`
- `refund.confirmed` observation

Signed refund failure:
- Refund becomes `FAILED`
- Booking escrow returns from `REFUND_PENDING` to `HELD`
- `refund.failed` observation

## Domain refund boundaries

Booking:
- `BookingFinancialService.markRefundedFromAuthoritativeRefund(...)`
- accepts only `FUNDED` / `DISPUTED`
- idempotent if already `REFUNDED`

Order:
- `CommerceFinancialService.markRefundedFromAuthoritativeRefund(...)`
- accepts only `PAID`
- tracked Product / ProductVariant inventory is restored inside a serializable transaction
- idempotent if already `REFUNDED`

Neither boundary is exposed directly to browser/mobile clients.

## Financial-operation webhook

Sandbox endpoint:

`POST /api/v1/payments/webhooks/sandbox-operations`

Supported signed event types:
- `payout.succeeded`
- `payout.failed`
- `refund.succeeded`
- `refund.failed`

The same server-only sandbox secret and canonical HMAC strategy are used as the payment collection sandbox.

## Reconciliation

Authenticated read:

`GET /api/v1/wallet/reconciliation`

Current report checks:
- confirmed payments whose business-domain application is missing
- payouts awaiting provider confirmation
- refunds awaiting provider confirmation
- failed financial webhooks linked to the user's payments
- negative user ledger-account balances
- unbalanced ledger transactions touching the user's accounts

The report is an observation/recovery aid. It does not invent provider success.

## Read models

- `GET /api/v1/wallet/withdrawals`
- `GET /api/v1/wallet/refunds`
- `GET /api/v1/payments/subjects/:subjectType/:subjectId/latest`

These permit UI recovery after refresh/network interruption without giving the browser write authority over financial state.

## Security invariants

- provider secrets remain server-only
- all consequential requests use idempotency
- successful payout/refund requires verified provider event
- ledger movements are balanced and append-only
- failed payout restores reserved funds through a compensating entry
- refund amount is derived from authoritative payment records
- Order inventory restoration happens only after authoritative refund confirmation
- stale failure events after success are ignored

## Gate

Runtime validation is intentionally deferred to the consolidated Phase 13 sandbox gate. Production payment activation remains blocked until that gate passes.
