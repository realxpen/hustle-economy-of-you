# Payments + Escrow

Status: CANONICAL — Phase 13 COMPLETE
Updated: 2026-09-14

## Purpose

Phase 13 makes money movement explicit, auditable and safe across Hustle transactions.

Source-defined goal:

> Solve the trust problem around money.

Source-defined service payment flow:

`Client pays → Payment confirmed → Funds held → Service performed → Completion confirmed → Funds released → Hustler receives payout`

The approved build scope includes:
- payment gateway
- transaction ledger
- escrow state
- wallet balance
- payout
- refund
- reconciliation
- webhooks
- idempotency

MVP wallet surfaces:
- Available balance
- Pending balance
- Escrow
- Transactions
- Withdraw

Phase gate:

> Money can move safely through a full sandbox transaction before production.

This gate passed on 2026-09-14. Production payment activation remains a separate human risk gate.

## Financial authority

Financial truth must come from verified server-side evidence, never a browser status change.

The browser may request that Hustle begin a payment, but it cannot declare that money was received, held, released, refunded or paid out.

Authoritative financial state comes from:
- a verified payment-provider response initiated by the server
- a verified provider webhook
- a reconciliation process that confirms provider state
- an internal financial transition that is valid against durable ledger/escrow state

No client endpoint may directly manufacture:
- Booking `FUNDED`
- Order `PAID`
- `REFUNDED`
- escrow release
- wallet credit
- payout success

## One financial system for Services and Products

Phase 13 does not create separate incompatible payment systems for Bookings and Orders.

A common financial layer owns money movement while transaction domains retain their own business lifecycle.

Supported payment/refund transaction subjects:
- `BOOKING`
- `ORDER`

Ledger subjects may additionally use:
- `PAYOUT` — operational ledger movements for withdrawal reservation, provider-confirmed payout and failed-payout reversal

`PAYOUT` is not a valid collection/refund transaction subject. Payment initialization and refund APIs remain restricted to `BOOKING` and `ORDER`.

Canonical relationship:

`Payment / Ledger / Escrow → transaction or financial-operation subject reference`

The subject remains authoritative for non-financial lifecycle state:
- Booking owns work lifecycle
- Order owns fulfillment lifecycle
- Phase 13 owns money lifecycle

## Payment gateway boundary

Provider integration sits behind a server-side adapter/port.

The domain depends on provider-neutral concepts such as:
- create payment intent/reference
- inspect/verify payment
- receive/verify webhook
- refund payment
- initiate payout/withdrawal
- inspect transfer/payout

Provider-specific payloads, signatures and status names stay inside the adapter.

Secrets remain server-side and are never exposed through web/mobile bundles.

The first implementation is sandbox-first. Provider choice does not leak through core domain models strongly enough to require a redesign later.

## Payment attempt

A PaymentAttempt represents one attempt to collect money for one transaction subject.

It preserves transaction-critical facts:
- internal ID
- transaction subject type + ID
- payer User
- beneficiary/seller/hustler User where applicable
- currency
- amount in minor units
- provider
- provider reference
- provider checkout/reference metadata required for verification
- status
- timestamps
- failure reason/code where safe to store

PaymentAttempt is not the ledger itself. Provider events may be retried or duplicated; the ledger records durable money movements exactly once.

## Transaction ledger

The ledger is the auditable financial record.

It uses immutable append-only entries rather than mutating historical money movements.

Every posted ledger entry identifies:
- transaction or financial-operation subject
- payment/payout/refund reference where applicable
- currency
- amount
- direction/account buckets
- event type
- idempotency key/reference
- created timestamp

Corrections happen through compensating entries, not by rewriting old entries.

The ledger supports deriving/reconciling:
- money collected
- money currently held
- money available to withdraw
- money released
- refunds
- payouts

Payout ledger entries use `subjectType=PAYOUT` and `subjectId=<payoutId>`. Earlier Phase 13 sandbox rows that temporarily used `ORDER` with `PAYOUT:<id>` were repaired by the Phase 13 finalization migrations.

## Escrow semantics

For Services, successful payment does not immediately become withdrawable Hustler balance.

Canonical service money lifecycle:

`Payment confirmed → HELD → work lifecycle → completion confirmed → RELEASED → available balance → payout`

Escrow state is explicit and server-authoritative.

Minimum conceptual states:
- `PENDING`
- `HELD`
- `RELEASED`
- `REFUND_PENDING`
- `REFUNDED`
- `CANCELLED`

Payment status, escrow status and Booking status remain distinct concepts.

For Product Orders, Phase 13 confirms payment and inventory ownership. Product funds use settlement semantics while Order fulfillment remains in the Order domain.

## Booking integration

Phase 11 stops paid Bookings at `PAYMENT_PENDING` until authoritative funding exists.

After authoritative payment confirmation:
- payment is verified idempotently
- financial records are posted
- escrow is placed into held state for a Service payment
- only then may the Booking move to `FUNDED`

Phase 13 calls the server-side Booking integration boundary rather than exposing `FUNDED` to the client.

No payment confirmation means no `FUNDED`.

## Order integration

Phase 12 creates seller-scoped `PENDING` Orders and does not reserve inventory.

After authoritative payment confirmation:
- current inventory is revalidated
- tracked inventory is deducted atomically with the authoritative Order payment transition
- financial records are posted exactly once
- only then may the Order move to `PAID`

Phase 13 uses `CommerceService.markPaidFromAuthoritativePayment(...)`.

If inventory is no longer available, the workflow fails safely and does not manufacture a paid Order.

## Wallet model

MVP wallet is a view over authoritative financial records, not a manually editable balance field.

User-facing buckets:
- Available balance — eligible for withdrawal/payout
- Pending balance — received but not yet available under settlement/business rules
- Escrow — funds held against active transactions
- Transactions — durable financial history

Balances are derived from authoritative ledger records with reconciliation checks. Clients cannot write balances directly.

## Payout / withdrawal

A payout moves eligible available balance to an external destination.

Rules:
- only the owning authenticated User may request withdrawal
- requested amount must not exceed eligible available balance
- funds are reserved against concurrent withdrawal attempts
- provider response/webhook is authoritative for payout completion
- failed payouts restore/reconcile reserved funds safely
- idempotency is required

Payout ledger movements are operational financial subjects, not Orders. They are classified as `PAYOUT` with the durable Payout ID as `subjectId`.

## Refunds

Refund state requires authoritative provider/financial evidence.

A refund flow may be triggered by cancellation, dispute resolution or operations, but the transaction domain does not switch to `REFUNDED` before the financial action is verified.

After verified refund:
- ledger receives compensating entries
- escrow/payment state updates
- Booking or Order receives authoritative refund transition through a server integration boundary

## Webhooks

Webhook endpoints are security-sensitive financial ingress.

They:
- verify provider signature/authenticity before processing
- store/derive an idempotency key from provider event/reference
- tolerate duplicate delivery
- tolerate stale/out-of-order delivery where possible
- never trust browser-provided webhook payloads
- return safely on already-processed events
- preserve enough sanitized provider metadata for debugging/reconciliation

Raw secrets are never logged.

## Idempotency

Every consequential money action has an idempotency strategy:
- payment initialization
- payment confirmation
- webhook processing
- ledger posting
- escrow hold/release/refund
- payout request
- payout confirmation
- refund request/confirmation

Repeated delivery of the same authoritative event does not duplicate ledger entries, inventory deductions, wallet credits, escrow releases, refunds or payouts.

## Reconciliation

Hustle can compare internal financial truth with provider/internal operation truth.

Current reconciliation detects:
- confirmed payments whose domain application is missing
- payouts awaiting provider confirmation
- refunds awaiting provider confirmation
- failed financial webhooks
- negative ledger-account balances
- unbalanced ledger transactions

Reconciliation is an observation/recovery aid. It never invents provider success.

## Observability

Financial events include IDs and non-sensitive financial metadata only.

Examples:
- `payment.initiated`
- `payment.confirmed`
- `payment.failed`
- `escrow.held`
- `escrow.released`
- `refund.requested`
- `refund.confirmed`
- `payout.requested`
- `payout.confirmed`
- `payout.failed`
- `reconciliation.mismatch`

Never place card/bank secrets, provider credentials, full sensitive webhook bodies, or private delivery/job requirements into SystemEvent payloads.

## Security invariants

- All provider secret keys remain server-side.
- Financial tables use API-role/server access; browser/mobile clients do not write them directly.
- Amount/currency/beneficiary are derived from canonical Booking/Order data, not trusted from the browser.
- Provider references are unique where required.
- Money values use integer minor units.
- Financial transitions are transactionally protected.
- External callbacks are verified before any state mutation.
- Production activation requires separate operational approval after sandbox gate.

## Phase 13 completion evidence

### Data + migration
- existing Supabase schema was safely baselined into Prisma migration history without reset/data loss
- `20260914134000_phase13_payout_subject_type` applied
- `20260914134100_phase13_payout_ledger_backfill` applied
- Prisma Client regeneration, API typecheck and build passed

### Service path
`Booking PAYMENT_PENDING → payment confirmed → escrow HELD → Booking FUNDED → work → completion → escrow RELEASED → available balance → payout`

### Product path
`Order PENDING → payment confirmed + inventory deduction → PAID → fulfillment → COMPLETED → settlement`

### Refunds
- Booking refund produced authoritative `REFUNDED` and removed held escrow exactly once
- Order refund produced authoritative `REFUNDED` and restored tracked inventory exactly once
- tested variant stock sequence `4 → 3 → 4`; duplicate refund webhook left stock at `4`

### Payouts
- payout success is authoritative and idempotent
- payout failure restores `PAYOUT_RESERVED → AVAILABLE` exactly once
- final post-migration payout wrote `PAYOUT_RESERVED` and `PAYOUT_SENT` ledger rows with `subjectType=PAYOUT` and the durable payout UUID as `subjectId`

### Recovery defect fixed
A Prisma interactive-transaction timeout could leave a provider-confirmed payment `SUCCEEDED` while domain application remained incomplete. Payment capture now uses explicit `maxWait: 10_000` and `timeout: 30_000`. Replaying the exact verified provider event completed domain application without a second charge.

### Final reconciliation
Both payer and beneficiary returned:
- `healthy: true`
- `issueCount: 0`
- `issues: []`

## Production activation boundary

Phase 13 completion does not automatically enable production money movement.

Production provider keys, production webhook routing, payout destinations, operational monitoring, reconciliation procedures and explicit human risk approval remain required before production activation.
