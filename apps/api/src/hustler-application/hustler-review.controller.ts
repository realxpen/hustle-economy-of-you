import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { HustleReviewerGuard } from "./hustle-reviewer.guard";
import {
  HustlerReviewService,
  type HustlerReviewDecisionInput
} from "./hustler-review.service";

@Controller("hustler-reviews")
@UseGuards(AuthGuard, HustleReviewerGuard)
export class HustlerReviewController {
  constructor(private readonly reviews: HustlerReviewService) {}

  @Get()
  list(
    @CurrentIdentity() identity: AuthIdentity,
    @Query("status") status?: string
  ) {
    return this.reviews.list(identity, status);
  }

  @Get(":applicationId")
  get(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string
  ) {
    return this.reviews.get(identity, applicationId);
  }

  @Post(":applicationId/start")
  start(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string
  ) {
    return this.reviews.start(identity, applicationId);
  }

  @Post(":applicationId/verification")
  setVerification(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string,
    @Body() body: HustlerReviewDecisionInput
  ) {
    return this.reviews.setVerification(identity, applicationId, body);
  }

  @Post(":applicationId/approve")
  approve(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string,
    @Body() body: HustlerReviewDecisionInput
  ) {
    return this.reviews.approve(identity, applicationId, body);
  }

  @Post(":applicationId/reject")
  reject(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string,
    @Body() body: HustlerReviewDecisionInput
  ) {
    return this.reviews.reject(identity, applicationId, body);
  }
}
