import { Module } from "@nestjs/common";
import { IsolatedSandboxFinanceController } from "./isolated-sandbox-finance.controller";

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
import { PaystackTestGateway } from "./paystack-test.gateway";
import { WalletController } from "./wallet.controller";
import { MoniflowSandboxReceiptController } from "./moniflow-sandbox-receipt.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [AuthModule, BookingModule, CommerceModule],
  controllers: [
    PaymentController,
    PaymentReadController,
    PaymentWebhookController,
    FinancialOperationsWebhookController,
    MoniflowSandboxReceiptController,
    IsolatedSandboxFinanceController,
    WalletController,
    FinancialHistoryController
  ],
  providers: [
    PaymentService,
    WalletService,
    FinancialOperationsService,
    FinancialReadService,
    SandboxPaymentGateway,
    PaystackTestGateway,
    SandboxFinancialOperationGateway,
    {
      provide: PAYMENT_GATEWAY,
      useFactory: (sandbox: SandboxPaymentGateway, paystack: PaystackTestGateway) => {
        const selected = process.env.HUSTLE_PAYMENT_GATEWAY?.trim() ?? "sandbox";
        if (selected === "sandbox") return sandbox;
        if (selected === "paystack-test") return paystack;
        throw new Error("Unsupported Hustle payment gateway; live-money providers are not enabled");
      },
      inject: [SandboxPaymentGateway, PaystackTestGateway]
    },
    { provide: FINANCIAL_OPERATION_GATEWAY, useExisting: SandboxFinancialOperationGateway }
  ],
  exports: [PaymentService, WalletService, FinancialOperationsService, FinancialReadService]
})
export class PaymentModule {}
