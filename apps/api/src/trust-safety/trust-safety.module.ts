import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BlockPolicyService } from "./block-policy.service";
import { TrustSafetyController } from "./trust-safety.controller";
import { TrustSafetyService } from "./trust-safety.service";

@Module({
  imports: [AuthModule],
  controllers: [TrustSafetyController],
  providers: [TrustSafetyService, BlockPolicyService],
  exports: [TrustSafetyService, BlockPolicyService]
})
export class TrustSafetyModule {}
