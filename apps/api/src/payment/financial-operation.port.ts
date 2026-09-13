import type { FinancialSubjectType } from "@prisma/client";

export const FINANCIAL_OPERATION_GATEWAY = Symbol("FINANCIAL_OPERATION_GATEWAY");

export interface SandboxPayoutRequest {
  operationId: string;
  userId: string;
  amountMinor: number;
  currency: string;
}

export interface SandboxRefundRequest {
  operationId: string;
  paymentReference: string;
  subjectType: FinancialSubjectType;
  subjectId: string;
  amountMinor: number;
  currency: string;
}

export interface SandboxOperationReference {
  provider: string;
  reference: string;
}

export type FinancialOperationWebhookType =
  | "payout.succeeded"
  | "payout.failed"
  | "refund.succeeded"
  | "refund.failed";

export interface FinancialOperationWebhookPayload {
  eventId: string;
  type: FinancialOperationWebhookType;
  reference: string;
  amountMinor: number;
  currency: string;
  failureCode?: string;
  failureReason?: string;
}

export interface VerifiedFinancialOperationWebhook {
  provider: string;
  eventId: string;
  type: FinancialOperationWebhookType;
  providerReference: string;
  amountMinor: number;
  currency: string;
  failureCode: string | null;
  failureReason: string | null;
  payloadDigest: string;
}

export interface FinancialOperationPort {
  createPayout(input: SandboxPayoutRequest): Promise<SandboxOperationReference>;
  createRefund(input: SandboxRefundRequest): Promise<SandboxOperationReference>;
  verifyWebhook(
    payload: unknown,
    signature: string | undefined
  ): Promise<VerifiedFinancialOperationWebhook>;
}
