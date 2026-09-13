import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BookingModule } from "../booking/booking.module";
import { CommerceModule } from "../commerce/commerce.module";
import { FINANCIAL_OPERATION_GATEWAY } from "./financial-operation.port";
import { FinancialOperationsWebhookController } from "./financial-operations.controller";
import { FinancialOperationsService } from "./financial-operations.service";
import { FinancialHistoryController, PaymentReadController } from "./financial-read.controller";
import { FinancialReadService } from "./financial-read.service";
import { PAYMENT_GATEWAY } from "./payment-gateway.port";
import { PaymentController, PaymentWebhookController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { SandboxFinancialOperationGateway } from "./sandbox-financial-operation.gateway";
import { SandboxPaymentGateway } from "./sandbox-payment.gateway";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [AuthModule, BookingModule, CommerceModule],
  controllers: [
    PaymentController,
    PaymentReadController,
    PaymentWebhookController,
    FinancialOperationsWebhookController,
    WalletController,
    FinancialHistoryController
  ],
  providers: [
    PaymentService,
    WalletService,
    FinancialOperationsService,
    FinancialReadService,
    SandboxPaymentGateway,
    SandboxFinancialOperationGateway,
    { provide: PAYMENT_GATEWAY, useExisting: SandboxPaymentGateway },
    { provide: FINANCIAL_OPERATION_GATEWAY, useExisting: SandboxFinancialOperationGateway }
  ],
  exports: [PaymentService, WalletService, FinancialOperationsService, FinancialReadService]
})
export class PaymentModule {}
