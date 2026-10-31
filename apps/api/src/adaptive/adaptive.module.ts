import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdaptiveController } from "./adaptive.controller";
import { AdaptiveFeatureGuard } from "./adaptive-feature.guard";
import { AdaptiveService } from "./adaptive.service";

@Module({
  imports: [AuthModule],
  controllers: [AdaptiveController],
  providers: [AdaptiveService, AdaptiveFeatureGuard],
  exports: [AdaptiveService]
})
export class AdaptiveModule {}
