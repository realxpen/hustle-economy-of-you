import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  TrustSafetyService,
  type CreateCounterpartyFeedbackInput,
  type CreateSafetyReportInput
} from "./trust-safety.service";

@Controller("trust-safety")
@UseGuards(AuthGuard)
export class TrustSafetyController {
  constructor(private readonly trustSafety: TrustSafetyService) {}

  @Get("feedback/eligibility/:subjectType/:subjectId")
  feedbackEligibility(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("subjectType") subjectType: string,
    @Param("subjectId") subjectId: string
  ) {
    return this.trustSafety.feedbackEligibility(identity, subjectType, subjectId);
  }

  @Post("feedback")
  createFeedback(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: CreateCounterpartyFeedbackInput
  ) {
    return this.trustSafety.createFeedback(identity, input);
  }

  @Get("feedback/me")
  myFeedback(@CurrentIdentity() identity: AuthIdentity) {
    return this.trustSafety.listMyFeedback(identity);
  }

  @Post("reports")
  createReport(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: CreateSafetyReportInput
  ) {
    return this.trustSafety.createReport(identity, input);
  }

  @Get("reports/me")
  myReports(@CurrentIdentity() identity: AuthIdentity) {
    return this.trustSafety.listMyReports(identity);
  }

  @Post("blocks/:targetUserId")
  block(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("targetUserId") targetUserId: string
  ) {
    return this.trustSafety.blockUser(identity, targetUserId);
  }

  @Delete("blocks/:targetUserId")
  unblock(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("targetUserId") targetUserId: string
  ) {
    return this.trustSafety.unblockUser(identity, targetUserId);
  }

  @Get("blocks")
  blocks(@CurrentIdentity() identity: AuthIdentity) {
    return this.trustSafety.listBlocks(identity);
  }
}
