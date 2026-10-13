import { FinancialDispatchState } from "@prisma/client";

/**
 * Explain durable outbox states without granting execution authority.
 * A read-only reconciliation report must NEVER initiate a money operation.
 */
export type DispatchRecoveryAction =
  | "CONTROLLED_QUEUED_REVIEW"
  | "VERIFY_PROVIDER_STATUS_NO_RETRY"
  | "AWAIT_VERIFIED_PROVIDER_SETTLEMENT"
  | "INVESTIGATE_MISSING_DISPATCH_COMMAND";

export function describeFinancialDispatch(state: FinancialDispatchState | null) {
  if (state === FinancialDispatchState.QUEUED) {
    return {
      dispatchState: state,
      recoveryAction: "CONTROLLED_QUEUED_REVIEW" as const,
      automaticRetryAllowed: false
    };
  }
  if (state === FinancialDispatchState.DISPATCHING || state === FinancialDispatchState.OUTCOME_UNKNOWN) {
    return {
      dispatchState: state,
      recoveryAction: "VERIFY_PROVIDER_STATUS_NO_RETRY" as const,
      automaticRetryAllowed: false
    };
  }
  if (state === FinancialDispatchState.SUBMITTED) {
    return {
      dispatchState: state,
      recoveryAction: "AWAIT_VERIFIED_PROVIDER_SETTLEMENT" as const,
      automaticRetryAllowed: false
    };
  }
  return {
    dispatchState: "MISSING" as const,
    recoveryAction: "INVESTIGATE_MISSING_DISPATCH_COMMAND" as const,
    automaticRetryAllowed: false
  };
}
