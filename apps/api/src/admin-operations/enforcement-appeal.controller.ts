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
import { EnforcementAppealService } from "./enforcement-appeal.service";

@Controller("appeals")
@UseGuards(AuthGuard)
export class EnforcementAppealController {
  constructor(private readonly appeals: EnforcementAppealService) {}

  @Get("eligible")
  eligible(@CurrentIdentity() identity: AuthIdentity) {
    return this.appeals.eligible(identity);
  }

  @Get("mine")
  mine(@CurrentIdentity() identity: AuthIdentity) {
    return this.appeals.mine(identity);
  }

  @Post()
  submit(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: {
      actionType?: unknown;
      enforcementRef?: unknown;
      reason?: unknown;
    }
  ) {
    return this.appeals.submit(identity, body);
  }
}

@Controller("admin/operations/appeals")
@UseGuards(AuthGuard, AdminGuard)
export class AdminEnforcementAppealController {
  constructor(private readonly appeals: EnforcementAppealService) {}

  @Get("overview")
  overview() {
    return this.appeals.overview();
  }

  @Get()
  list(
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.appeals.list(status, limit);
  }

  @Get(":appealId")
  detail(@Param("appealId") appealId: string) {
    return this.appeals.detail(appealId);
  }

  @Post(":appealId/claim")
  claim(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("appealId") appealId: string
  ) {
    return this.appeals.claim(identity, appealId);
  }

  @Post(":appealId/decision")
  decide(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("appealId") appealId: string,
    @Body() body: { decision?: unknown; reason?: unknown }
  ) {
    return this.appeals.decide(identity, appealId, body);
  }

  @Post(":appealId/close")
  close(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("appealId") appealId: string
  ) {
    return this.appeals.close(identity, appealId);
  }
}
