# MONIFlow provider evidence vs. signed intake — finance authority boundary

Date: 2026-10-13. This branch adds read-only evidence classification to Hustle's existing user-authorized reconciliation report. It changes no financial gateway, financial webhook, wallet ledger, refund/payout reservation, custody or settlement state.

The existing `MoniflowSandboxReceiptObservation` record is a signed and deduplicated indication that MONIFlow received a command. It is **not** a provider-bank attestation. The new pure `classifyProviderEvidenceReadiness()` function ALWAYS fails closed: even when a signed receipt is present and its recorded terms are consistent, `providerEvidenceStatus=NOT_VERIFIED`, `providerSettlementConfirmed=false` and `moneyMovementAllowedByThisEvidence=false`. Inconsistent kind/amount/currency/receipt-digest format raises read-only OBSERVATION_CONFLICT reporting.

Production financial success must never be derived from a HUSTLE_SANDBOX signature, a MONIFlow RECEIVED event, an internal HTTP 200/202, user-uploaded screenshots, an AI assertion or a simulated provider capability flag. It requires a separately implemented, verified and approved external provider evidence chain, with strict marketplace custody and recipient identity gating.

The existing provider states are preserved: PaymentAttempt `PENDING`, Payout/Refund `REQUESTED` or `PROCESSING` and `OUTCOME_UNKNOWN` dispatch are not advanced or retried. This diagnostic does not grant finance-admin permissions.
