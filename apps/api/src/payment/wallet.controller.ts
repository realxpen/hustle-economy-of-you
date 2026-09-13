import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  FinancialOperationsService,
  type RequestPayoutInput,
  type RequestRefundInput
} from "./financial-operations.service";
import { WalletService } from "./wallet.service";

@Controller("wallet")
@UseGuards(AuthGuard)
export class WalletController {
  constructor(
    private readonly wallet: WalletService,
    private readonly operations: FinancialOperationsService
  ) {}

  @Get()
  getWallet(@CurrentIdentity() identity: AuthIdentity) {
    return this.wallet.getWallet(identity);
  }

  @Get("transactions")
  listTransactions(@CurrentIdentity() identity: AuthIdentity, @Query("limit") limit?: string) {
    return this.wallet.listTransactions(identity, { limit });
  }

  @Get("reconciliation")
  reconciliation(@CurrentIdentity() identity: AuthIdentity) {
    return this.operations.reconciliation(identity);
  }

  @Post("withdrawals")
  requestWithdrawal(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: RequestPayoutInput,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.operations.requestPayout(identity, input, idempotencyKey);
  }

  @Post("refunds")
  requestRefund(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() input: RequestRefundInput,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.operations.requestRefund(identity, input, idempotencyKey);
  }

  @Post("escrows/bookings/:bookingId/release")
  releaseBookingEscrow(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string
  ) {
    return this.wallet.releaseBookingEscrow(identity, bookingId);
  }

  @Post("settlements/orders/:orderId/release")
  releaseOrderSettlement(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("orderId") orderId: string
  ) {
    return this.wallet.releaseOrderSettlement(identity, orderId);
  }
}
