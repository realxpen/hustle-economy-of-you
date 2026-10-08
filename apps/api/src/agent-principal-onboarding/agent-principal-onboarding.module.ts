import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AgentRelationshipModule } from "../agent-relationship/agent-relationship.module";
import { AgentPrincipalOnboardingController } from "./agent-principal-onboarding.controller";
import { AgentPrincipalOnboardingService } from "./agent-principal-onboarding.service";

@Module({
  imports: [AuthModule, AgentRelationshipModule],
  controllers: [AgentPrincipalOnboardingController],
  providers: [AgentPrincipalOnboardingService]
})
export class AgentPrincipalOnboardingModule {}
