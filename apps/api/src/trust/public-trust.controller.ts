import { Controller, Get, Param, Query } from "@nestjs/common";

import { PublicTrustService } from "./public-trust.service";

@Controller("trust")
export class PublicTrustController {
  constructor(private readonly trust: PublicTrustService) {}

  @Get("users/:userId/summary")
  providerSummary(
    @Param("userId") userId: string,
    @Query("limit") limit?: string
  ) {
    return this.trust.providerSummary(userId, limit);
  }
}
