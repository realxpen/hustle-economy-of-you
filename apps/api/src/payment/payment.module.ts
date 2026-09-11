import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BookingModule } from "../booking/booking.module";
import { CommerceModule } from "../commerce/commerce.module";
import { PAYMENT_GATEWAY } from "./payment-gateway.port";
import { PaymentController, PaymentWebhookController } from "./payment.controller";
import { PaymentService } from "./payment.service";
import { SandboxPaymentGateway } from "./sandbox-payment.gateway";

@Module({
  imports: [AuthModule, BookingModule, CommerceModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [
    PaymentService,
    SandboxPaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: SandboxPaymentGateway }
  ],
  exports: [PaymentService]
})
export class PaymentModule {}
