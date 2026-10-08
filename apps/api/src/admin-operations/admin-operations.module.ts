import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AdminOperationsController } from "./admin-operations.controller";
import { AdminOperationsService } from "./admin-operations.service";
import { MarketplaceCaseService } from "./marketplace-case.service";
import { MarketplaceCaseController } from "./marketplace-case.controller";
import { MarketplaceModerationController } from "./marketplace-moderation.controller";
import { MarketplaceModerationService } from "./marketplace-moderation.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminOperationsController, MarketplaceCaseController, MarketplaceModerationController],
  providers: [AdminOperationsService, MarketplaceCaseService, MarketplaceModerationService],
  exports: [AdminOperationsService]
})
export class AdminOperationsModule {}
