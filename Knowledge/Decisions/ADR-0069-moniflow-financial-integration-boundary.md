# ADR-0069 — Hustle × MONIFlow financial authority and integration boundary

Date: 2026-10-13
Status: PROPOSED — Phase 00 architecture, no provider integration or monetary activation.
Scope: Hustle Financial Phase 13 (Booking/Order/Wallet/Escrow/Payout/Refund) and proposed MONIFlow partner execution interface.

## Context
Hustle already owns financial authority via accepted ADR-0012, `Knowledge/Product/PAYMENTS_AND_ESCROW.md`, NestJS `PaymentService`, `FinancialOperationsService`, `WalletService`, `PaymentGatewayPort` and `FinancialOperationPort`. A successful provider event is not itself authorization to skip Bookings, Orders, inventory or ledger gates.

MONIFlow, a distinct Fastify/React Native hackathon project, has BMONI and simulated provider adapters, native wallet signing, human-reviewed money plans, and activity/Pockets. It currently lacks a verified marketplace merchant collection/escrow/refund service, as well as a Hustle service-to-service partner API. Its latest `PROJECT_STATE.md` identifies a 409 BMONI sandbox identity mapping blocker. A simulated complete MONIFlow flow is not evidence of BMONI completion.

Owner requested MONIFlow integration for Hustle client checkout, wallet operations and payouts with sandbox-first release discipline.

## Decision: one ledger and explicit authority separation
1. **Hustle is the marketplace system of record**: who owes/receives funds; agreed terms and snapshots; payer/beneficiary; payment attempt; double-entry append-only ledger; Booking escrow `HELD`/`RELEASED`; Order `PENDING`/`AVAILABLE` settlement; refund/payout eligibility; current user-facing wallet buckets.
2. **MONIFlow is a provider-operation coordinator**: idempotent collection/payout/refund attempts only for actually supported partner-authorized capabilities; provider status verification; device/human signing when required; normalized signed execution evidence; partner delivery and reconciliation. It never sets Hustle ledger/Booking/Order states directly.
3. **Actual custody and bank movement are external provider responsibilities** under approved legal/contractual arrangements; internal `EscrowRecord` does not itself establish safeguarded custody. MONIFlow's Pockets are not Hustle escrow. NGN and CNGN require provider-supported unit/FX/rail handling, not implicit 1:1 assumption.
4. Hustle client/browser/mobile never calls MONIFlow's operator financial routes with a `localUserId`. A mutually authenticated backend adapter, tenant isolation and scoped service identity are required. Proposed versioned commands/event schemas are documented in MONIFlow `docs/HUSTLE_PARTNER_INTEGRATION_V1.md` and `packages/shared/src/partner-contracts.ts`. These are **proposed contracts**, not real BMONI endpoints or deployed partner routes.
5. Only authenticated, owner-authorized Hustle requests can create payment/refund/payout commands. Amount, subject, payer/beneficiary and currency derive from canonical database facts. Extra body fields, cross-tenant requests, changed idempotency semantics and unsigned callbacks fail closed.
6. Provider `SUCCEEDED` status requires authenticated and independently retrievable evidence; on disagreement, timeout or missing reconciliation the operation remains pending/unknown. External provider response, MONIFlow plan approval and local simulation do not automatically advance Hustle financial state.
7. Production provider use requires separately accepted KYC/AML/custody, merchant collections, refund support, operational monitoring, signed webhook ingress, and owner approval. Sandbox contracts cannot activate production by environmental accident.

## P0 finding: reserve-before-execute
At time of review, `FinancialOperationsService.requestPayout()` invokes `gateway.createPayout()` **before** its DB transaction creates `Payout` and transfers AVAILABLE → PAYOUT_RESERVED. Likewise `requestRefund()` invokes `gateway.createRefund()` **before** durable Refund + Booking `REFUND_PENDING` are persisted. A real provider could move money and leave Hustle without a committed intent/reservation. This is safe only insofar as the current gateway is HUSTLE_SANDBOX and creates local deterministic references.

Future real/partner adapter must be **blocked** until the ordered durable workflow is implemented:
- authorize and validate eligibility; derive canonical details; bind idempotency key and verified beneficiary destination;
- atomically create a REQUESTED record + financial reservation/eligibility freeze and durable outbox command;
- after commit, async worker claims, authenticates and sends the operation to MONIFlow with a stable operationId and idempotency key;
- persist provider reference/evidence; unknown timeout remains UNKNOWN/PROCESSING with reconciliation (no blind replay);
- process verified callbacks into idempotent ledger/domain finalization or refund/failed-payout compensating entries;
- ensure concurrent withdrawals/refunds, cancellation, and release/dispute races cannot double-spend.
For order refunds the settlement/payout eligibility must also be frozen while pending, not only Booking `EscrowRecord`.

No code in this Phase 00 contract PR changes existing payout/refund execution. Do not switch providers until this P0 defect is corrected and tested with disposable DB + fault injection.

## Reference contract
v1 sandbox command envelope: `version=1`, `partner=HUSTLE`, `environment=sandbox`, durable `operationId` and `idempotencyKey`, kind COLLECTION/PAYOUT/REFUND, agreed amountMinor positive safe integer and `currency=NGN`. Provider proof, `simulated` labeling, tenant/operation/source correlation on events. Future currencies require new explicit capability agreement.

Operation examples:
- COLLECTION: canonical BOOKING or ORDER ID, authenticated payer and beneficiary reference, payment attempt ID.
- PAYOUT: canonical Hustle Payout ID, approved beneficiary reference, verified destination reference and actual durable reservation reference.
- REFUND: original payment reference, authorized Refund ID and refund hold evidence.

Protocol security: transport TLS plus authenticated workload/service identity (audience, tenant, operation scopes, expiry); signed raw-body webhooks with clock window, replay cache and key rotation; deny anonymous tenant labels and spoofable caller-local UUID; sanitized audit logs; least-privilege secrets.

## Acceptance gates
- Contract schemas and negative tests without network calls.
- Financial P0 patch (separate PR) tests "provider unavailable / throws / response lost", two concurrent withdrawals, same idempotency/different amount conflict, duplicate success/failure, reserved release, refund race, cross-user denial.
- Independent webhook status verification, provider reconciliation and legal custody agreement before real payment.
- Preserve one-account progressive capabilities, original Booking/Order and sandbox tests.

## Supersession / compatibility
Extends **ADR-0012**, does not replace it. MONIFlow is optional and provider-swappable; no schema or merchant flow may require customer wallet onboarding merely to browse or pay unless a specific supported provider is selected and the experience is approved.
