import { Module } from "@nestjs/common";

import { AgentRelationshipModule } from "../agent-relationship/agent-relationship.module";
import { AuthModule } from "../auth/auth.module";
import { BookingModule } from "../booking/booking.module";
import { AgentClientOperationsController } from "./agent-client-operations.controller";
import { AgentClientOperationsService } from "./agent-client-operations.service";

@Module({
  imports: [
    AuthModule,
    AgentRelationshipModule,
    BookingModule
  ],
  controllers: [AgentClientOperationsController],
  providers: [AgentClientOperationsService],
  exports: [AgentClientOperationsService]
})
export class AgentClientOperationsModule {}
