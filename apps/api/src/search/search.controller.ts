import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  SearchObservationService,
  type SearchObservationInput
} from "./search-observation.service";
import { SearchService, type DiscoveryQueryInput } from "./search.service";

@Controller("search")
@UseGuards(AuthGuard)
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly observationService: SearchObservationService
  ) {}

  @Get()
  searchTop(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: DiscoveryQueryInput
  ) {
    return this.searchService.search(identity, "top", query);
  }

  @Post("events")
  recordObservation(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: SearchObservationInput
  ) {
    return this.observationService.recordSearch(identity, input);
  }

  @Get(":tab")
  searchTab(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("tab") tab: string,
    @Query() query: DiscoveryQueryInput
  ) {
    return this.searchService.search(identity, tab, query);
  }
}
