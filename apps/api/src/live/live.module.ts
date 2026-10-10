import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { DatabaseModule } from "../database/database.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { LiveController } from "./live.controller";
import { LiveLifecycleService } from "./live-lifecycle.service";
import { LiveMediaService } from "./live-media.service";
import { LiveService } from "./live.service";

@Module({
  imports: [AuthModule, DatabaseModule, TrustSafetyModule, NotificationsModule],
  controllers: [LiveController],
  providers: [LiveService, LiveMediaService, LiveLifecycleService]
})
export class LiveModule {}
