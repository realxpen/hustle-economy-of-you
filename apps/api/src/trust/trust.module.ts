import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { PublicTrustController } from "./public-trust.controller";
import { PublicTrustService } from "./public-trust.service";
import { ReviewController } from "./review.controller";
import { ReviewEligibilityService } from "./review-eligibility.service";
import { ReviewService } from "./review.service";

@Module({
  imports: [AuthModule],
  controllers: [ReviewController, PublicTrustController],
  providers: [ReviewEligibilityService, ReviewService, PublicTrustService],
  exports: [ReviewEligibilityService, ReviewService, PublicTrustService]
})
export class TrustModule {}
