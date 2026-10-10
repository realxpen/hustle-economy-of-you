import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { AnalyticsModule } from "../analytics/analytics.module";
import { MarketplaceController } from "./marketplace.controller";
import { SearchController } from "./search.controller";
import { SearchObservationService } from "./search-observation.service";
import { SearchService } from "./search.service";

@Module({
  imports: [AuthModule, AnalyticsModule],
  controllers: [SearchController, MarketplaceController],
  providers: [SearchService, SearchObservationService],
  exports: [SearchService]
})
export class SearchModule {}
