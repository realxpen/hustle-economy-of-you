import type { FinancialSubjectType } from "@prisma/client";

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

export interface FinancialOperationPort {
  createPayout(input: SandboxPayoutRequest): Promise<SandboxOperationReference>;
  createRefund(input: SandboxRefundRequest): Promise<SandboxOperationReference>;
}
