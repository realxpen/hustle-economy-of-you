import { Controller, Get, Param, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { ReviewEligibilityService } from "./review-eligibility.service";

@Controller("reviews")
@UseGuards(AuthGuard)
export class ReviewController {
  constructor(private readonly reviewEligibility: ReviewEligibilityService) {}

  @Get("eligibility/:subjectType/:subjectId")
  eligibility(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("subjectType") subjectType: string,
    @Param("subjectId") subjectId: string
  ) {
    return this.reviewEligibility.get(identity, subjectType, subjectId);
  }
}
