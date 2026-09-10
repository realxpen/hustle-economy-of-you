import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { CartController, OrderController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";

@Module({
  imports: [AuthModule],
  controllers: [CartController, OrderController],
  providers: [CommerceService],
  exports: [CommerceService]
})
export class CommerceModule {}
