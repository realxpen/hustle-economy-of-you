import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";

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
    return this.payments.handleVerifiedWebhook(payload, signature);
  }
}
