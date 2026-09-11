import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartController, OrderController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { FulfillmentService } from "./fulfillment.service";

@Module({
  imports: [AuthModule],
  controllers: [CartController, OrderController],
  providers: [CommerceService, FulfillmentService],
  exports: [CommerceService, FulfillmentService]
})
export class CommerceModule {}
