import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { SearchService, type DiscoveryQueryInput } from "./search.service";

@Controller("search")
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  searchTop(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: DiscoveryQueryInput
  ) {
    return this.searchService.search(identity, "top", query);
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
