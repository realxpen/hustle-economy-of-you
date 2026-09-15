import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { MessagingController } from "./messaging.controller";
import { MessagingPresenceService } from "./messaging-presence.service";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [AuthModule, TrustSafetyModule],
  controllers: [MessagingController],
  providers: [MessagingService, MessagingPresenceService]
})
export class MessagingModule {}
