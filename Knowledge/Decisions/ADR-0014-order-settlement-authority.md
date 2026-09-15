# ADR-0014 — Order settlement release authority

Status: Accepted
Date: 2026-09-15

## Decision

For Product Orders, settlement release is controlled by the **buyer**, never the seller.

The seller may progress fulfillment through PAID → PROCESSING → SHIPPED/DELIVERED, but may not move their own pending balance into available funds.

After the seller marks an Order delivered, the buyer is the authority that confirms completion. Once the Order is COMPLETED, only that same buyer may release the completed settlement to the seller's available balance.

## Why

Hustle must not allow a beneficiary to self-authorize release of funds owed to themselves. This matches the service-booking escrow rule where the client controls release after verified completion.

The rule is enforced twice:

1. frontend — only a BUYER viewing a COMPLETED Order receives the settlement-release action;
2. backend — `releaseOrderSettlement` rejects any caller other than `buyerUserId`.

Frontend visibility is convenience only. Backend authorization remains authoritative.

## Related invariants

- Seller cannot release their own Order settlement.
- Order must be `COMPLETED` before settlement release.
- The Order must have an authoritative applied successful payment.
- Settlement release remains idempotent.
- Seller wallet credit remains ledger-backed.
