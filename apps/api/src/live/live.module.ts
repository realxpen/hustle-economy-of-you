import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { LiveController } from "./live.controller";
import { LiveMediaService } from "./live-media.service";
import { LiveService } from "./live.service";

@Module({
  imports: [AuthModule, DatabaseModule, TrustSafetyModule],
  controllers: [LiveController],
  providers: [LiveService, LiveMediaService]
})
export class LiveModule {}
