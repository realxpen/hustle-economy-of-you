import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { ReviewEligibilityService } from "./review-eligibility.service";
import { ReviewService, type CreateReviewInput } from "./review.service";

@Controller("reviews")
@UseGuards(AuthGuard)
export class ReviewController {
  constructor(
    private readonly reviewEligibility: ReviewEligibilityService,
    private readonly reviews: ReviewService
  ) {}

  @Get("eligibility/:subjectType/:subjectId")
  eligibility(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("subjectType") subjectType: string,
    @Param("subjectId") subjectId: string
  ) {
    return this.reviewEligibility.get(identity, subjectType, subjectId);
  }

  @Post()
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: CreateReviewInput
  ) {
    return this.reviews.create(identity, input);
  }

  @Get("me/given")
  given(
    @CurrentIdentity() identity: AuthIdentity,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    return this.reviews.listGiven(identity, { cursor, limit });
  }

  @Get("users/:userId/received")
  received(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("userId") userId: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ) {
    return this.reviews.listReceived(identity, userId, { cursor, limit });
  }

  @Get("users/:userId/reputation")
  reputation(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("userId") userId: string
  ) {
    return this.reviews.reputation(identity, userId);
  }

  @Get(":reviewId")
  byId(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("reviewId") reviewId: string
  ) {
    return this.reviews.getById(identity, reviewId);
  }
}
