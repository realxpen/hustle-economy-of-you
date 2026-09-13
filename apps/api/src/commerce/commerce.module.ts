import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartController, OrderController } from "./commerce.controller";
import { CommerceFinancialService } from "./commerce-financial.service";
import { CommerceService } from "./commerce.service";
import { FulfillmentService } from "./fulfillment.service";

@Module({
  imports: [AuthModule],
  controllers: [CartController, OrderController],
  providers: [CommerceService, FulfillmentService, CommerceFinancialService],
  exports: [CommerceService, FulfillmentService, CommerceFinancialService]
})
export class CommerceModule {}
