import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";

import {
  HustlerApplicationService,
  type SaveHustlerApplicationInput
} from "./hustler-application.service";

@Controller("hustler-application")
@UseGuards(AuthGuard)
export class HustlerApplicationController {
  constructor(
    private readonly applications: HustlerApplicationService
  ) {}

  @Get()
  getMine(
    @CurrentIdentity() identity: AuthIdentity
  ) {
    return this.applications.getMine(identity);
  }

  @Put()
  saveDraft(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SaveHustlerApplicationInput
  ) {
    return this.applications.saveDraft(identity, body);
  }

  @Post("submit")
  submit(
    @CurrentIdentity() identity: AuthIdentity
  ) {
    return this.applications.submit(identity);
  }
}
