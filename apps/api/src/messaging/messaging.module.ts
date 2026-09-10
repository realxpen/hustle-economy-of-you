import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MessagingController } from "./messaging.controller";
import { MessagingPresenceService } from "./messaging-presence.service";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [AuthModule],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingPresenceService]
})
export class MessagingModule {}
