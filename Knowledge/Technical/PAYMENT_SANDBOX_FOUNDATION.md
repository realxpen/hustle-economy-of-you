# Phase 13 Sandbox Payment Foundation

Status: IMPLEMENTED — runtime validation pending
Updated: 2026-09-11

## Scope

This document records the concrete Phase 13A + 13B implementation under the canonical product rules in `Knowledge/Product/PAYMENTS_AND_ESCROW.md` and ADR-0012.

## Financial data foundation

Hosted migration: `20260911143316 phase13_financial_foundation`.

Created server-owned financial entities:
- `PaymentAttempt`
- `LedgerAccount`
- `LedgerTransaction`
- `LedgerPosting`
- `EscrowRecord`
- `Payout`
- `Refund`
- `WebhookEvent`

All financial tables have RLS enabled. The only direct database policy is the dedicated `hustle_api` server role. Browser/mobile clients do not receive direct table-write authority.

### PaymentAttempt

One provider collection attempt for one BOOKING or ORDER subject.

Important fields include:
- subject type + subject ID
- payer User ID
- beneficiary User ID
- provider + provider reference
- unique idempotency key
- amount/currency
- provider status
- confirmation timestamp
- domain application timestamp
- safe failure metadata

A provider-confirmed attempt may exist temporarily with `domainAppliedAt = null` if the downstream Booking/Order transition fails. This is intentional: external financial truth is not erased. The mismatch is observable and retry/reconciliation can complete the internal application later.

### Ledger

Ledger uses append-only transactions plus balanced postings.

A confirmed payment creates exactly one idempotent ledger transaction with:
- PROVIDER_CLEARING debit
- beneficiary ESCROW credit for Bookings, or beneficiary PENDING credit for Orders

Historical postings are not rewritten.

### Escrow

A successful Booking payment creates one subject-scoped escrow record in `HELD` before the Booking becomes `FUNDED`.

Escrow release/refund behavior belongs to Phase 13C/13D.

### Wallet projection

Wallet state remains a projection over user-owned ledger accounts/postings. Phase 13A intentionally does not introduce a browser-editable balance field. Public wallet API/UI belongs to Phase 13C.

### Payout / Refund

Durable payout and refund workflow entities exist now so later provider workflows do not require a financial schema redesign. Their operational endpoints are deferred to Phase 13D.

## Gateway boundary

Provider integration is behind `PaymentGatewayPort`.

First adapter: `SandboxPaymentGateway` (`HUSTLE_SANDBOX`).

The adapter:
- creates deterministic provider references for internal attempts
- keeps secrets server-side
- verifies sandbox webhook authenticity with HMAC-SHA256
- emits provider-neutral verified webhook data into `PaymentService`

Required server-only environment variable:

`HUSTLE_SANDBOX_WEBHOOK_SECRET`

Never expose it through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables.

## API

Authenticated:
- `POST /api/v1/payments/initialize`
- `GET /api/v1/payments/:paymentAttemptId`

Financial ingress, not authenticated as a User:
- `POST /api/v1/payments/webhooks/sandbox`

The webhook is accepted only after valid HMAC verification.

### Initialize payment

Required header:
- `Idempotency-Key`

Body:
- `subjectType`: `BOOKING` or `ORDER`
- `subjectId`

All financial terms are server-derived.

BOOKING:
- payer = Booking client
- beneficiary = booked Hustler
- amount = Booking agreed price
- currency = Booking currency
- Booking must currently be `PAYMENT_PENDING`

ORDER:
- payer = Order buyer
- beneficiary = Order seller
- amount = Order total
- currency = Order currency
- Order must currently be `PENDING`

A current PENDING/SUCCEEDED payment attempt for the same subject is reused rather than creating concurrent duplicate collections.

## Sandbox webhook verification

Supported event types:
- `payment.succeeded`
- `payment.failed`

Webhook fields:
- `eventId`
- `type`
- `reference`
- `amountMinor`
- `currency`
- optional `failureCode`
- optional `failureReason`

Canonical HMAC message:

`eventId|type|reference|amountMinor|CURRENCY|failureCode|failureReason`

Signature header:

`x-hustle-sandbox-signature: <hex HMAC-SHA256>`

Duplicate provider event IDs are stored and processed idempotently.

## Authoritative success path

### Booking

`PAYMENT_PENDING`
→ verified `payment.succeeded`
→ PaymentAttempt `SUCCEEDED`
→ balanced ledger capture
→ EscrowRecord `HELD`
→ existing server-only Booking funding boundary
→ Booking `FUNDED`
→ PaymentAttempt `domainAppliedAt`

No browser endpoint can directly set Booking `FUNDED`.

### Order

`PENDING`
→ verified `payment.succeeded`
→ PaymentAttempt `SUCCEEDED`
→ existing server-only Order payment boundary
→ inventory revalidated/deducted atomically with Order `PAID`
→ balanced ledger capture to seller PENDING account
→ PaymentAttempt `domainAppliedAt`

No browser endpoint can directly set Order `PAID`.

If inventory is insufficient after external payment succeeds, the PaymentAttempt remains authoritative provider truth while Order stays unadvanced and a `reconciliation.mismatch` event is recorded. Refund/reconciliation handling is Phase 13D.

## Observability

Current financial events include:
- `payment.initiated`
- `payment.confirmed`
- `payment.failed`
- `escrow.held`
- `reconciliation.mismatch`

Booking/Order integration continues to emit their existing authoritative lifecycle events.

No provider secret, private Booking requirements, private delivery data, card data, or full webhook body is copied into SystemEvent payloads.

## Validation gate

Phase 13A/B runtime validation must prove at least:
- authenticated payer can initialize payment
- non-payer cannot initialize the subject payment
- missing/invalid webhook signature is rejected
- signed success advances a Booking to `FUNDED` and creates HELD escrow exactly once
- signed success advances a fresh Order to `PAID` and deducts tracked inventory exactly once
- duplicate signed webhook does not duplicate ledger postings, escrow, inventory deductions or domain transitions
- wrong amount/currency is rejected
- signed failure marks the attempt failed without funding/paying the subject
