import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type {
  InitializeGatewayPaymentInput,
  InitializeGatewayPaymentResult,
  PaymentGatewayPort,
  VerifiedGatewayWebhook
} from "./payment-gateway.port";

const PROVIDER = "PAYSTACK_TEST";
const PAYSTACK_API = "https://api.paystack.co";
const PAYSTACK_CHECKOUT_HOST = "checkout.paystack.com";

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new BadRequestException("Invalid Paystack response or event");
  }
  return input as Record<string, unknown>;
}
function nonempty(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new BadRequestException(`Invalid Paystack ${field}`);
  return value.trim();
}
function amount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new BadRequestException("Invalid Paystack amount");
  }
  return value;
}

@Injectable()
export class PaystackTestGateway implements PaymentGatewayPort {
  private testKey(): string {
    const key = process.env.PAYSTACK_TEST_SECRET_KEY?.trim() ?? "";
    // Never accept sk_live_ or a publishable key in this integration.
    if (!/^sk_test_[A-Za-z0-9]+$/.test(key)) {
      throw new ServiceUnavailableException("Paystack test secret is not configured");
    }
    return key;
  }

  private async apiRequest(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(PAYSTACK_API + path, {
        ...init,
        headers: {
          authorization: `Bearer ${this.testKey()}`,
          ...(init.body ? { "content-type": "application/json" } : {})
        },
        signal: controller.signal,
        cache: "no-store"
      });
      // Do not propagate Paystack's untrusted response body or credentials.
      if (!response.ok) throw new BadGatewayException("Paystack test API rejected the payment request");
      const body = record(await response.json());
      if (body.status !== true) throw new BadGatewayException("Paystack test API returned an unsuccessful response");
      return record(body.data);
    } catch (error) {
      if (error instanceof BadGatewayException || error instanceof ServiceUnavailableException) throw error;
      throw new BadGatewayException("Paystack test API is temporarily unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  async initializePayment(input: InitializeGatewayPaymentInput): Promise<InitializeGatewayPaymentResult> {
    const email = nonempty(input.payerEmail, "payer email");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException("Verify your email address before paying");
    }
    if (input.currency.toUpperCase() !== "NGN") {
      throw new BadRequestException("Paystack test checkout currently supports NGN on Hustle");
    }
    const chargeAmount = amount(input.amountMinor);
    const reference = `hustle-${input.attemptId}`;
    const callbackOrigin = process.env.PAYSTACK_TEST_RETURN_ORIGIN?.trim();
    let callbackUrl: string | undefined;
    if (callbackOrigin) {
      const origin = new URL(callbackOrigin);
      if (origin.protocol !== "https:" || origin.origin !== callbackOrigin ||
          origin.username || origin.password || origin.hash || origin.search) {
        throw new ServiceUnavailableException("Paystack return origin must be an HTTPS origin");
      }
      const subjectRoute = input.subjectType === "ORDER" ? "orders" : "bookings";
      callbackUrl = `${origin.origin}/${subjectRoute}/${encodeURIComponent(input.subjectId)}?payment_return=1`;
    }

    const data = await this.apiRequest("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({
        email,
        amount: chargeAmount,
        currency: "NGN",
        reference,
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        metadata: {
          hustle_attempt_id: input.attemptId,
          hustle_subject_type: input.subjectType,
          hustle_subject_id: input.subjectId,
          integration: "paystack-test"
        }
      })
    });
    const checkoutUrl = nonempty(data.authorization_url, "checkout URL");
    const url = new URL(checkoutUrl);
    if (url.protocol !== "https:" || url.hostname !== PAYSTACK_CHECKOUT_HOST || url.username || url.password) {
      throw new BadGatewayException("Paystack test API returned an untrusted checkout URL");
    }
    if (data.reference !== reference) {
      throw new BadGatewayException("Paystack payment reference mismatch");
    }
    return {
      provider: PROVIDER,
      providerReference: reference,
      checkoutUrl: url.href,
      metadata: { environment: "test", subjectType: input.subjectType, subjectId: input.subjectId }
    };
  }

  /**
   * Check a pending attempt using our own stored reference and private test key.
   * The browser callback is never accepted as financial evidence.
   * Non-success statuses remain pending and cannot change the Order or ledger.
   */
  async verifyReference(providerReference: string): Promise<VerifiedGatewayWebhook | null> {
    const reference = nonempty(providerReference, "reference");
    const verified = await this.apiRequest(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
    if (verified.reference !== reference || verified.domain !== "test") {
      throw new UnauthorizedException("Paystack verification returned the wrong reference or environment");
    }
    const status = nonempty(verified.status, "status");
    if (status !== "success") return null;
    const transactionId = verified.id;
    if ((typeof transactionId !== "number" && typeof transactionId !== "string") ||
        !/^\d+$/.test(String(transactionId))) {
      throw new BadRequestException("Paystack transaction ID missing");
    }
    const amountMinor = amount(verified.amount);
    const currency = nonempty(verified.currency, "currency").toUpperCase();
    // Deterministic evidence across retries; distinct from the raw signed-webhook event.
    const evidence = JSON.stringify([reference, String(transactionId), amountMinor, currency, status, "test"]);
    return {
      provider: PROVIDER,
      eventId: `verify.success:${transactionId}`,
      type: "payment.succeeded",
      providerReference: reference,
      amountMinor,
      currency,
      failureCode: null,
      failureReason: null,
      payloadDigest: createHash("sha256").update(evidence).digest("hex")
    };
  }

  async verifyWebhook(
    payload: unknown,
    signature: string | undefined,
    rawBody?: Buffer
  ): Promise<VerifiedGatewayWebhook | null> {
    // Verify the exact signed bytes, not JSON.stringify(parsedBody).
    const key = this.testKey();
    if (!rawBody?.length || !signature || !/^[a-f\d]{128}$/i.test(signature)) {
      throw new UnauthorizedException("Missing Paystack signed webhook evidence");
    }
    const expected = createHmac("sha512", key).update(rawBody).digest();
    const received = Buffer.from(signature, "hex");
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) {
      throw new UnauthorizedException("Invalid Paystack webhook signature");
    }
    const event = record(payload);
    if (event.event !== "charge.success") {
      // Paystack sends unrelated events. Acknowledge but never apply financial state.
      return null;
    }
    const signed = record(event.data);
    const reference = nonempty(signed.reference, "reference");
    const transactionId = signed.id;
    if ((typeof transactionId !== "number" && typeof transactionId !== "string") ||
        !/^\d+$/.test(String(transactionId))) {
      throw new BadRequestException("Paystack transaction ID missing");
    }
    if (signed.status !== "success" || signed.domain !== "test") {
      throw new UnauthorizedException("Paystack event is not a successful test transaction");
    }
    // A valid HMAC alone is not a funds confirmation: verify independently with Paystack.
    const verified = await this.apiRequest(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" });
    if (verified.reference !== reference ||
        verified.status !== "success" ||
        verified.domain !== "test" ||
        String(verified.id) !== String(transactionId) ||
        amount(verified.amount) !== amount(signed.amount) ||
        nonempty(verified.currency, "currency").toUpperCase() !== nonempty(signed.currency, "currency").toUpperCase()) {
      throw new UnauthorizedException("Paystack verified transaction does not match the signed event");
    }

    return {
      provider: PROVIDER,
      eventId: `charge.success:${transactionId}`,
      type: "payment.succeeded",
      providerReference: reference,
      amountMinor: amount(verified.amount),
      currency: nonempty(verified.currency, "currency").toUpperCase(),
      failureCode: null,
      failureReason: null,
      payloadDigest: createHash("sha256").update(rawBody).digest("hex")
    };
  }
}
