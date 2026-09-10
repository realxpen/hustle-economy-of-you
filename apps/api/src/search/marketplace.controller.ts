import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  SearchObservationService,
  type SearchObservationInput
} from "./search-observation.service";
import { SearchService, type DiscoveryQueryInput } from "./search.service";

@Controller("marketplace")
@UseGuards(AuthGuard)
export class MarketplaceController {
  constructor(
    private readonly searchService: SearchService,
    private readonly observationService: SearchObservationService
  ) {}

  @Get()
  marketplaceAll(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: DiscoveryQueryInput
  ) {
    return this.searchService.marketplace(identity, "all", query);
  }

  @Post("events")
  recordObservation(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: SearchObservationInput
  ) {
    return this.observationService.recordMarketplace(identity, input);
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
