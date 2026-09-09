import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { MarketplaceController } from "./marketplace.controller";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [AuthModule],
  controllers: [SearchController, MarketplaceController],
  providers: [SearchService],
  exports: [SearchService]
})
export class SearchModule {}
