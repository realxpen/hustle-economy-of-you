import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { WalletService } from "./wallet.service";

@Controller("wallet")
@UseGuards(AuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  getWallet(@CurrentIdentity() identity: AuthIdentity) {
    return this.wallet.getWallet(identity);
  }

  @Get("transactions")
  listTransactions(@CurrentIdentity() identity: AuthIdentity, @Query("limit") limit?: string) {
    return this.wallet.listTransactions(identity, { limit });
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
