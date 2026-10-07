import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import {
  AgentRelationshipController,
  PrincipalAgentRelationshipController
} from "./agent-relationship.controller";
import { AgentRelationshipService } from "./agent-relationship.service";

@Module({
  imports: [AuthModule],
  controllers: [
    PrincipalAgentRelationshipController,
    AgentRelationshipController
  ],
  providers: [AgentRelationshipService],
  exports: [AgentRelationshipService]
})
export class AgentRelationshipModule {}
