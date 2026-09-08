import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";

import { HustlerApplicationController } from "./hustler-application.controller";
import { HustlerApplicationService } from "./hustler-application.service";
import { HustleReviewerGuard } from "./hustle-reviewer.guard";
import { HustlerReviewController } from "./hustler-review.controller";
import { HustlerReviewService } from "./hustler-review.service";

@Module({
  imports: [AuthModule],
  controllers: [HustlerApplicationController, HustlerReviewController],
  providers: [
    HustlerApplicationService,
    HustlerReviewService,
    HustleReviewerGuard
  ],
  exports: [HustlerApplicationService, HustlerReviewService]
})
export class HustlerApplicationModule {}
