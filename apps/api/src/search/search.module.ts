import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MarketplaceController } from "./marketplace.controller";
import { SearchController } from "./search.controller";
import { SearchObservationService } from "./search-observation.service";
import { SearchService } from "./search.service";

@Module({
  imports: [AuthModule],
  controllers: [SearchController, MarketplaceController],
  providers: [SearchService, SearchObservationService],
  exports: [SearchService]
})
export class SearchModule {}
