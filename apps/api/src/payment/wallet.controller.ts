import { Controller, Get, Query, UseGuards } from "@nestjs/common";

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
}
