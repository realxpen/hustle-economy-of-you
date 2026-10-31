import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdaptiveController } from "./adaptive.controller";
import { AdaptiveFeatureGuard } from "./adaptive-feature.guard";
import { AdaptiveService } from "./adaptive.service";
import { AdaptiveRosterService } from "./adaptive-roster.service";

@Module({
  imports: [AuthModule],
  controllers: [AdaptiveController],
  providers: [AdaptiveService, AdaptiveRosterService, AdaptiveFeatureGuard],
  exports: [AdaptiveService]
})
export class AdaptiveModule {}
