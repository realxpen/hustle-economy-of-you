import { Body, Controller, Get, Headers, HttpCode, NotFoundException, Param, Post, RawBodyRequest, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { type InitializePaymentInput, PaymentService } from "./payment.service";

@Controller("payments")
@UseGuards(AuthGuard)
export class PaymentController {
  constructor(private readonly payments: PaymentService) {}

  @Post("initialize")
  initialize(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: InitializePaymentInput,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.payments.initialize(identity, input, idempotencyKey);
  }

  @Post("attempts/:paymentAttemptId/verify")
  confirmPendingFromProvider(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("paymentAttemptId") paymentAttemptId: string
  ) {
    return this.payments.confirmPendingFromProvider(identity, paymentAttemptId);
  }

  @Get(":paymentAttemptId")
  getAttempt(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("paymentAttemptId") paymentAttemptId: string
  ) {
    return this.payments.getAttempt(identity, paymentAttemptId);
  }
}

@Controller("payments/webhooks")
export class PaymentWebhookController {
  constructor(private readonly payments: PaymentService) {}

  @Post("sandbox")
  sandbox(
    @Body() payload: unknown,
    @Headers("x-hustle-sandbox-signature") signature?: string
  ) {
    if (process.env.HUSTLE_PAYMENT_GATEWAY === "paystack-test") throw new NotFoundException();
    return this.payments.handleVerifiedWebhook(payload, signature);
  }

  @Post("paystack")
  @HttpCode(200)
  paystack(
    @Body() payload: unknown,
    @Headers("x-paystack-signature") signature: string | undefined,
    @Req() request: RawBodyRequest<Request>
  ) {
    if (process.env.HUSTLE_PAYMENT_GATEWAY !== "paystack-test") throw new NotFoundException();
    return this.payments.handleVerifiedWebhook(payload, signature, request.rawBody);
  }
}
