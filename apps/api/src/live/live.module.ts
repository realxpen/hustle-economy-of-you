import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module";
import { TrustSafetyModule } from "../trust-safety/trust-safety.module";
import { LiveController } from "./live.controller";
import { LiveService } from "./live.service";

@Module({
  imports: [DatabaseModule, TrustSafetyModule],
  controllers: [LiveController],
  providers: [LiveService]
})
export class LiveModule {}
