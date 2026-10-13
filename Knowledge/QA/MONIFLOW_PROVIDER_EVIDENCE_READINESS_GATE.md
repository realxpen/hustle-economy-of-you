# Hustle × MONIFlow — Provider Evidence Reconciliation Gate

Date: 2026-10-13
Status: **Read-only sandbox diagnostic implementation; real provider proof unavailable.**

## Merged dependency state
- MONIFlow PR #7 merged at `6a25a565164a901d4ee414854f5a8882ec28703e`.
- Hustle PR #112 merged at `3e828e83ba89c5af90efff6f14b845ab43ba1621`.
- These integrations transport and durably deduplicate `operation.received` notifications only. They do not collect funds, initiate a bank payout or perform refunds.

## Evidence hierarchy (do not conflate)
1. **Partner command sent:** Hustle has authorized an intent and persisted its local attempt/reservation/hold. This is NOT payment.
2. **Authenticated MONIFlow command receipt:** Signed `operation.received` with event ID, canonical command digest, amount/currency. This proves only durable command intake by MONIFlow. It is **not** a provider transaction or money.
3. **Verified provider evidence (NOT AVAILABLE):** An approved and authenticated provider status inquiry + provider-signed event, operation correlation, amount/currency, merchant/beneficiary, terminal status, anti-replay, provider rail authorization and custody eligibility. Must be independently verified before Hustle's finance state machine can be considered for actual settlement.

The current MONIFlow provider feature flags explicitly say `providerExecutionEnabled=false`, `merchantCollectionsEnabled=false`, `payoutsEnabled=false`, `refundsEnabled=false`, `custodyEnabled=false`. `moniflow-sandbox` is simulated, and the historical BMONI path has a 409 user-mapping blocker. Do not claim BMONI proves merchant checkout, refunds, escrow custody or payouts. Those cannot be inferred from its wallet/offramp descriptions.

## New read-only user-scoped diagnostic
Existing authenticated `GET /api/v1/wallet/reconciliation` will:
- Read only pending HUSTLE_SANDBOX PaymentAttempts belonging to the authenticated payer/beneficiary (latest 100), pending own payouts, and refunds involving payer or beneficiary.
- Resolve stored MONIFlow sandbox receipt observations ONLY for these authorized operation IDs. Never globally list outbox items or user IDs.
- Add `PARTNER_COLLECTION_RECEIPT_AWAITING_PROVIDER_PROOF` for a pending collection **only when** it has an observed receipt; the PaymentAttempt remains PENDING.
- Keep existing `PAYOUT_AWAITING_PROVIDER` and `REFUND_AWAITING_PROVIDER` codes and dispatch-state reporting, adding receipt diagnostic fields.
- Report `partnerReceiptStatus` = NO_PARTNER_RECEIPT, COMMAND_RECEIVED_ONLY, or OBSERVATION_CONFLICT and `providerEvidenceStatus=NOT_VERIFIED`.
- Always report `providerSettlementConfirmed=false`, `providerVerificationSource=null`, `moneyMovementAllowedByThisEvidence=false` and `reconciliationAction=AWAIT_INDEPENDENT_PROVIDER_EVIDENCE` or INVESTIGATE_RECEIPT_INTEGRITY.
- Make **ZERO** database mutations from the diagnostic, no callbacks, retries or user-provided provider proofs.

## Required CI acceptance
- [ ] Foundation CI passes on final PR SHA.
- [ ] Isolated Payment Sandbox passes and tests missing and conflicting receipt classifications without performing financial operations.
- [ ] Cross-repo signed sandbox integration passes on immutable MONIFlow mainline SHA with an authentic unpaid Order / authorized Payout / Refund receipt and asserts all three remain NOT_VERIFIED, including an OUTCOME_UNKNOWN payout/refund.
- [ ] Wrong user does not see another user's payout evidence; no ledger balance or settlement changes from reading.
- [ ] No production deploy, no active provider gateway switches, no BMONI keys/claims and no terminal provider events created.

## Separate later stage — actual provider evidence adapter
Before a real adapter is authorized, collect BMONI provider-issued sandbox API references, identity/KYC proofs, per-merchant collection/refund/payout capabilities, callbacks or independently queried statuses, legal custody/settlement terms, bank destination verification, signing/auth key rotation, fees/failure reversals, transaction references and evidence retention requirements. Implement a **sandbox-only read-only evidence verifier** against that actual approved interface, then independently approve any financial-state transition PR. Do not manufacture success from simulation.
