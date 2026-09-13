import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { FinancialReadService } from "./financial-read.service";

@Controller("payments")
@UseGuards(AuthGuard)
export class PaymentReadController {
  constructor(private readonly reads: FinancialReadService) {}

  @Get("subjects/:subjectType/:subjectId/latest")
  latestForSubject(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("subjectType") subjectType: string,
    @Param("subjectId") subjectId: string
  ) {
    return this.reads.latestPaymentForSubject(identity, subjectType, subjectId);
  }
}

@Controller("wallet")
@UseGuards(AuthGuard)
export class FinancialHistoryController {
  constructor(private readonly reads: FinancialReadService) {}

  @Get("withdrawals")
  payouts(@CurrentIdentity() identity: AuthIdentity, @Query("limit") limit?: string) {
    return this.reads.listPayouts(identity, limit);
  }

  @Get("refunds")
  refunds(@CurrentIdentity() identity: AuthIdentity, @Query("limit") limit?: string) {
    return this.reads.listRefunds(identity, limit);
  }
}
