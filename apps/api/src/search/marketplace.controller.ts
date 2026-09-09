import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { SearchService, type DiscoveryQueryInput } from "./search.service";

@Controller("marketplace")
@UseGuards(AuthGuard)
export class MarketplaceController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  marketplaceAll(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: DiscoveryQueryInput
  ) {
    return this.searchService.marketplace(identity, "all", query);
  }

  @Get(":tab")
  marketplaceTab(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("tab") tab: string,
    @Query() query: DiscoveryQueryInput
  ) {
    return this.searchService.marketplace(identity, tab, query);
  }
}
