import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BookingModule } from "../booking/booking.module";
import { CommerceModule } from "../commerce/commerce.module";
import { PAYMENT_GATEWAY } from "./payment-gateway.port";
import { PaymentController, PaymentWebhookController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { SandboxPaymentGateway } from "./sandbox-payment.gateway";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({
  imports: [AuthModule, BookingModule, CommerceModule],
  controllers: [PaymentController, PaymentWebhookController, WalletController],
  providers: [
    PaymentService,
    WalletService,
    SandboxPaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: SandboxPaymentGateway }
  ],
  exports: [PaymentService, WalletService]
})
export class PaymentModule {}
