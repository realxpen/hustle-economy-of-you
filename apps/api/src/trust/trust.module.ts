import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ReviewController } from "./review.controller";
import { ReviewEligibilityService } from "./review-eligibility.service";

@Module({
  imports: [AuthModule],
  controllers: [ReviewController],
  providers: [ReviewEligibilityService],
  exports: [ReviewEligibilityService]
})
export class TrustModule {}
