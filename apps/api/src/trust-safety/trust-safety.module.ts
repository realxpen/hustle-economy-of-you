import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TrustSafetyController } from "./trust-safety.controller";
import { TrustSafetyService } from "./trust-safety.service";

@Module({
  imports: [AuthModule],
  controllers: [TrustSafetyController],
  providers: [TrustSafetyService],
  exports: [TrustSafetyService]
})
export class TrustSafetyModule {}
