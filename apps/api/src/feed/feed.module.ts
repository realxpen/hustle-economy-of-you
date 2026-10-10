import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { FeedController } from "./feed.controller";
import { FeedService } from "./feed.service";

@Module({
  imports: [AuthModule, AnalyticsModule],
  controllers: [FeedController],
  providers: [FeedService],
  exports: [FeedService]
})
export class FeedModule {}
