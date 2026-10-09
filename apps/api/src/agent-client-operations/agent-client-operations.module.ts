import { Module } from "@nestjs/common";

import { AgentRelationshipModule } from "../agent-relationship/agent-relationship.module";
import { AuthModule } from "../auth/auth.module";
import { BookingModule } from "../booking/booking.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AgentClientOperationsController } from "./agent-client-operations.controller";
import { AgentClientOperationsService } from "./agent-client-operations.service";

@Module({
  imports: [
    AuthModule,
    AgentRelationshipModule,
    BookingModule,
    NotificationsModule
  ],
  controllers: [AgentClientOperationsController],
  providers: [AgentClientOperationsService],
  exports: [AgentClientOperationsService]
})
export class AgentClientOperationsModule {}
