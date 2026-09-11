import type { FinancialSubjectType } from "@prisma/client";

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export interface InitializeGatewayPaymentInput {
  attemptId: string;
  subjectType: FinancialSubjectType;
  subjectId: string;
  amountMinor: number;
  currency: string;
}

export interface InitializeGatewayPaymentResult {
  provider: string;
  providerReference: string;
  checkoutUrl: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}

export type SandboxWebhookType = "payment.succeeded" | "payment.failed";

export interface SandboxWebhookPayload {
  eventId: string;
  type: SandboxWebhookType;
  reference: string;
  amountMinor: number;
  currency: string;
  failureCode?: string;
  failureReason?: string;
}

export interface VerifiedGatewayWebhook {
  provider: string;
  eventId: string;
  type: SandboxWebhookType;
  providerReference: string;
  amountMinor: number;
  currency: string;
  failureCode: string | null;
  failureReason: string | null;
  payloadDigest: string;
}

export interface PaymentGatewayPort {
  initializePayment(input: InitializeGatewayPaymentInput): Promise<InitializeGatewayPaymentResult>;
  verifyWebhook(payload: unknown, signature: string | undefined): Promise<VerifiedGatewayWebhook>;
}
