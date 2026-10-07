import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AgentApplicationController } from "./agent-application.controller";
import { AgentApplicationService } from "./agent-application.service";
import { AgentReviewController } from "./agent-review.controller";
import { AgentReviewService } from "./agent-review.service";

@Module({
  imports: [AuthModule],
  controllers: [AgentApplicationController, AgentReviewController],
  providers: [AgentApplicationService, AgentReviewService],
  exports: [AgentApplicationService, AgentReviewService]
})
export class AgentApplicationModule {}
