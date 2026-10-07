import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AgentRelationshipModule } from "../agent-relationship/agent-relationship.module";
import { AgentAssistedOnboardingController } from "./agent-assisted-onboarding.controller";
import { AgentAssistedOnboardingService } from "./agent-assisted-onboarding.service";

@Module({
  imports: [AuthModule, AgentRelationshipModule],
  controllers: [AgentAssistedOnboardingController],
  providers: [AgentAssistedOnboardingService],
  exports: [AgentAssistedOnboardingService]
})
export class AgentAssistedOnboardingModule {}
