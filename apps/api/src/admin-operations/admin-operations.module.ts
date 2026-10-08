import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AdminOperationsController } from "./admin-operations.controller";
import { AdminOperationsService } from "./admin-operations.service";
import { MarketplaceCaseService } from "./marketplace-case.service";
import { MarketplaceCaseController } from "./marketplace-case.controller";

@Module({
  imports: [AuthModule],
  controllers: [AdminOperationsController, MarketplaceCaseController],
  providers: [AdminOperationsService, MarketplaceCaseService],
  exports: [AdminOperationsService]
})
export class AdminOperationsModule {}
