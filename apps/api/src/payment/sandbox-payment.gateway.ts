import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type {
  InitializeGatewayPaymentInput,
  InitializeGatewayPaymentResult,
  PaymentGatewayPort,
  SandboxWebhookPayload,
  VerifiedGatewayWebhook
} from "./payment-gateway.port";

const PROVIDER = "HUSTLE_SANDBOX";

@Injectable()
export class SandboxPaymentGateway implements PaymentGatewayPort {
  constructor(private readonly config: ConfigService) {}

  async initializePayment(input: InitializeGatewayPaymentInput): Promise<InitializeGatewayPaymentResult> {
    return {
      provider: PROVIDER,
      providerReference: `hsbx_${input.attemptId}`,
      checkoutUrl: null,
      metadata: {
        environment: "sandbox",
        subjectType: input.subjectType,
        subjectId: input.subjectId
      }
    };
  }

  async verifyWebhook(payload: unknown, signature: string | undefined): Promise<VerifiedGatewayWebhook> {
    const parsed = this.parsePayload(payload);
    const secret = this.config.get<string>("HUSTLE_SANDBOX_WEBHOOK_SECRET")?.trim();
    if (!secret) {
      throw new UnauthorizedException("Sandbox webhook verification is not configured");
    }
    if (!signature?.trim()) {
      throw new UnauthorizedException("Missing sandbox webhook signature");
    }

    const canonical = this.canonicalPayload(parsed);
    const expected = createHmac("sha256", secret).update(canonical).digest("hex");
    const actual = signature.trim().toLowerCase();
    const expectedBuffer = Buffer.from(expected, "utf8");
    const actualBuffer = Buffer.from(actual, "utf8");

    if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) {
      throw new UnauthorizedException("Invalid sandbox webhook signature");
    }

    return {
      provider: PROVIDER,
      eventId: parsed.eventId,
      type: parsed.type,
      providerReference: parsed.reference,
      amountMinor: parsed.amountMinor,
      currency: parsed.currency,
      failureCode: parsed.failureCode ?? null,
      failureReason: parsed.failureReason ?? null,
      payloadDigest: createHash("sha256").update(canonical).digest("hex")
    };
  }

  private parsePayload(payload: unknown): SandboxWebhookPayload {
    if (!payload || typeof payload !== "object") {
      throw new BadRequestException("Invalid sandbox webhook payload");
    }
    const value = payload as Record<string, unknown>;
    const eventId = this.requiredText(value.eventId, "eventId", 200);
    const type = value.type;
    if (type !== "payment.succeeded" && type !== "payment.failed") {
      throw new BadRequestException("Unsupported sandbox webhook event type");
    }
    const reference = this.requiredText(value.reference, "reference", 300);
    const amountMinor = Number(value.amountMinor);
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new BadRequestException("amountMinor must be a positive integer");
    }
    const currency = this.requiredText(value.currency, "currency", 12).toUpperCase();
    return {
      eventId,
      type,
      reference,
      amountMinor,
      currency,
      failureCode: this.optionalText(value.failureCode, 120),
      failureReason: this.optionalText(value.failureReason, 500)
    };
  }

  private canonicalPayload(payload: SandboxWebhookPayload) {
    return [
      payload.eventId,
      payload.type,
      payload.reference,
      String(payload.amountMinor),
      payload.currency.toUpperCase(),
      payload.failureCode ?? "",
      payload.failureReason ?? ""
    ].join("|");
  }

  private requiredText(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    const normalized = value.trim();
    if (normalized.length > max) throw new BadRequestException(`${field} is too long`);
    return normalized;
  }

  private optionalText(value: unknown, max: number) {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value !== "string") throw new BadRequestException("Invalid optional webhook text field");
    const normalized = value.trim();
    if (!normalized) return undefined;
    if (normalized.length > max) throw new BadRequestException("Webhook text field is too long");
    return normalized;
  }
}
