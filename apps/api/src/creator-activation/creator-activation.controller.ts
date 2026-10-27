import { Controller, Get, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { CreatorActivationService } from "./creator-activation.service";

@Controller("creator-activation")
@UseGuards(AuthGuard)
export class CreatorActivationController {
  constructor(private readonly activation: CreatorActivationService) {}

  @Get()
  mine(@CurrentIdentity() identity: AuthIdentity) {
    return this.activation.mine(identity);
  }
}
