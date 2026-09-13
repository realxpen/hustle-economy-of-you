import { Body, Controller, Headers, Post } from "@nestjs/common";

import { FinancialOperationsService } from "./financial-operations.service";

@Controller("payments/webhooks")
export class FinancialOperationsWebhookController {
  constructor(private readonly operations: FinancialOperationsService) {}

  @Post("sandbox-operations")
  sandboxOperations(
    @Body() payload: unknown,
    @Headers("x-hustle-sandbox-signature") signature?: string
  ) {
    return this.operations.handleWebhook(payload, signature);
  }
}
