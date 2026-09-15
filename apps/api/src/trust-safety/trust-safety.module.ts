import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AdminSafetyController } from "./admin-safety.controller";
import { AdminSafetyService } from "./admin-safety.service";
import { BlockPolicyService } from "./block-policy.service";
import { TrustSafetyController } from "./trust-safety.controller";
import { TrustSafetyService } from "./trust-safety.service";

@Module({
  imports: [AuthModule],
  controllers: [TrustSafetyController, AdminSafetyController],
  providers: [TrustSafetyService, BlockPolicyService, AdminSafetyService],
  exports: [TrustSafetyService, BlockPolicyService, AdminSafetyService]
})
export class TrustSafetyModule {}
