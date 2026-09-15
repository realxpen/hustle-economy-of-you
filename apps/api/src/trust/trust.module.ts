import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { ReviewController } from "./review.controller";
import { ReviewEligibilityService } from "./review-eligibility.service";
import { ReviewService } from "./review.service";

@Module({
  imports: [AuthModule],
  controllers: [ReviewController],
  providers: [ReviewEligibilityService, ReviewService],
  exports: [ReviewEligibilityService, ReviewService]
})
export class TrustModule {}
