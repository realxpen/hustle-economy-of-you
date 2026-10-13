/**
 * Observational classification ONLY. A MONIFlow receipt proves command intake
 * and is NOT a licensed provider or bank's collection/settlement attestation.
 * No function here can approve a payment, refund, payout or ledger mutation.
 */
export type FinancialCommandKind = "COLLECTION" | "PAYOUT" | "REFUND";

export type SandboxReceiptRecord = {
  kind: string;
  amountMinor: number;
  currency: string;
  observedAt: Date;
  commandDigest: string;
} | null;

export function classifyProviderEvidenceReadiness(
  kind: FinancialCommandKind,
  amountMinor: number,
  currency: string,
  receipt: SandboxReceiptRecord
) {
  const inconsistent = receipt !== null && (
    receipt.kind !== kind ||
    receipt.amountMinor !== amountMinor ||
    receipt.currency !== currency ||
    !/^[a-f0-9]{64}$/.test(receipt.commandDigest)
  );
  const status = inconsistent ? "OBSERVATION_CONFLICT"
    : receipt ? "COMMAND_RECEIVED_ONLY" : "NO_PARTNER_RECEIPT";

  return {
    partnerReceiptStatus: status,
    partnerReceiptObservedAt: receipt?.observedAt ?? null,
    providerEvidenceStatus: "NOT_VERIFIED" as const,
    providerVerificationSource: null,
    providerSettlementConfirmed: false as const,
    moneyMovementAllowedByThisEvidence: false as const,
    reconciliationAction: inconsistent
      ? "INVESTIGATE_RECEIPT_INTEGRITY" as const
      : "AWAIT_INDEPENDENT_PROVIDER_EVIDENCE" as const
  };
}
