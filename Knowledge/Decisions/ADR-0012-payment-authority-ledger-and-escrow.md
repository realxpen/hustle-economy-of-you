# ADR-0012 — Payment authority, ledger, escrow, wallet, and provider boundary

Status: Accepted
Date: 2026-09-11

## Context

Phase 11 and Phase 12 intentionally stop before manufacturing financial truth.

Bookings currently stop at `PAYMENT_PENDING` until authoritative funding exists.

Orders currently stop at `PENDING` until authoritative payment exists.

The approved Phase 13 source requires:
- payment gateway
- transaction ledger
- escrow state
- wallet balance
- payout
- refund
- reconciliation
- webhooks
- idempotency

with the service flow:

`Client pays → Payment confirmed → Funds held → Service performed → Completion confirmed → Funds released → Hustler receives payout`.

We need one financial architecture that can safely serve both Bookings and Orders without letting provider-specific details or browser requests become financial authority.

## Decision

### 1. Phase 13 is the sole owner of authoritative money state

Booking and Order domains retain business lifecycle ownership, but Phase 13 owns:
- payment confirmation
- ledger posting
- escrow hold/release
- refunds
- wallet balances/projections
- payouts
- reconciliation

No browser/mobile request may directly set authoritative paid/funded/refunded/released/payout-success state.

### 2. One common financial layer serves Bookings and Orders

Financial records reference a transaction subject:
- `BOOKING`
- `ORDER`

We will not create independent payment stacks for Services and Products.

### 3. Provider integration is behind an adapter/port

Core financial logic depends on provider-neutral operations rather than direct provider SDK semantics.

Provider secrets and provider-specific payload verification remain inside server-side infrastructure adapters.

The first implementation is sandbox-first.

### 4. PaymentAttempt is not the ledger

A PaymentAttempt tracks collection workflow/provider state.

The ledger is the durable append-only money record.

Provider retries, duplicate webhooks or verification calls must never duplicate ledger entries.

### 5. Ledger history is append-only

Posted money movements are not rewritten.

Corrections, refunds and reversals use compensating entries linked to their originating financial transaction.

Money is stored in integer minor units.

### 6. Escrow state is separate from payment state and Booking state

A successful service payment creates/advances escrow to held state before the Booking becomes financially ready for work.

Payment provider status, escrow status and Booking status remain distinct concepts.

Normal service sequence:

`payment confirmed → escrow HELD → Booking FUNDED → work → completion confirmation → escrow RELEASED → available balance → payout`

### 7. Existing Phase 11/12 server integration boundaries remain authoritative

For Bookings, Phase 13 calls the existing server-side funding boundary after verified payment + escrow hold.

For Orders, Phase 13 calls `CommerceService.markPaidFromAuthoritativePayment(...)` after verified payment.

For paid Orders, inventory revalidation/deduction remains atomic with authoritative payment transition.

We do not expose these boundaries directly to the browser.

### 8. Wallet is a financial projection, not a client-editable balance

Available, pending and escrow balances derive from authoritative financial records/ledger-backed state.

A User cannot directly mutate balance fields.

### 9. Refund and payout completion require external financial evidence

A request may begin a refund or payout workflow, but successful refund/payout state requires verified provider response/webhook/reconciliation.

Order/Booking `REFUNDED` state is downstream of confirmed financial refund, never a substitute for it.

### 10. Webhooks are verified and idempotent financial ingress

Webhook authenticity/signature must be verified before mutation.

Provider events/references are deduplicated.

Duplicate or out-of-order delivery must not duplicate:
- ledger postings
- inventory deductions
- escrow holds/releases
- wallet credits/debits
- refunds
- payouts

### 11. Reconciliation is part of the MVP financial system

We will not treat successful HTTP responses alone as sufficient long-term financial truth.

The system must be able to compare provider state against internal payment, ledger, escrow, refund and payout state and surface mismatches.

### 12. Production activation is a separate human risk gate

Passing sandbox payment flows does not automatically enable production money movement.

Production provider keys, webhook endpoints, payout configuration and operational procedures require explicit human approval after the Phase 13 sandbox gate.

## Consequences

### Positive
- Booking and Order payments share one coherent financial model.
- Browser/client compromise cannot directly manufacture money state.
- Duplicate webhooks can be handled safely.
- Ledger history remains auditable.
- Escrow semantics remain distinct from transaction lifecycle semantics.
- Wallet, refund and payout behavior can be reconciled against provider truth.
- Provider replacement/addition does not require rewriting core commerce domains.

### Tradeoffs
- More durable financial entities and idempotency constraints are required before a simple payment button can be considered complete.
- Phase 13 must coordinate multiple domain transitions transactionally/idempotently.
- A sandbox pass is necessary but not sufficient for production launch.
- Wallet balances cannot be treated as a single convenient mutable number.

## Rejected alternatives

### Let the frontend mark a successful payment
Rejected because client state is not authoritative financial evidence.

### Use Booking/Order status as the complete money ledger
Rejected because business state cannot provide auditable debit/credit/refund/payout history.

### Put provider SDK calls directly inside Booking/Order services
Rejected because it couples core business domains to external payment semantics and secrets.

### Immediately credit seller/Hustler available balance when payment succeeds
Rejected for Services because funds must be held in escrow until valid release conditions are met, and for commerce generally because settlement/payout eligibility must be explicit.

### Mutate historical ledger rows during refunds/corrections
Rejected because financial history must remain auditable; compensating entries are required.

### Treat webhook delivery as exactly-once
Rejected because providers may retry or deliver events out of order. Idempotency is mandatory.
