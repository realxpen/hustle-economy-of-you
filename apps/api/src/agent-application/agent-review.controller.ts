import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  AgentReviewService,
  type AgentReviewDecisionInput
} from "./agent-review.service";

@Controller("admin/agent-applications")
@UseGuards(AuthGuard, AdminGuard)
export class AgentReviewController {
  constructor(private readonly reviews: AgentReviewService) {}

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
    @Body() body: AgentReviewDecisionInput
  ) {
    return this.reviews.setVerification(identity, applicationId, body);
  }

  @Post(":applicationId/proofs/:proofId/read-url")
  createProofReadUrl(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string,
    @Param("proofId") proofId: string
  ) {
    return this.reviews.createProofReadUrl(identity, applicationId, proofId);
  }

  @Post(":applicationId/approve")
  approve(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string,
    @Body() body: AgentReviewDecisionInput
  ) {
    return this.reviews.approve(identity, applicationId, body);
  }

  @Post(":applicationId/reject")
  reject(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("applicationId") applicationId: string,
    @Body() body: AgentReviewDecisionInput
  ) {
    return this.reviews.reject(identity, applicationId, body);
  }
}
