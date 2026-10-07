import { Module } from "@nestjs/common";

import { AgentRelationshipModule } from "../agent-relationship/agent-relationship.module";
import { AuthModule } from "../auth/auth.module";
import { AgentBusinessController } from "./agent-business.controller";
import { AgentBusinessService } from "./agent-business.service";

@Module({
  imports: [AuthModule, AgentRelationshipModule],
  controllers: [AgentBusinessController],
  providers: [AgentBusinessService],
  exports: [AgentBusinessService]
})
export class AgentBusinessModule {}
