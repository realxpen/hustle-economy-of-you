import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";

import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";

import {
  HustlerApplicationService,
  type AddHustlerProofInput,
  type SaveHustlerApplicationInput
} from "./hustler-application.service";

@Controller("hustler-application")
@UseGuards(AuthGuard)
export class HustlerApplicationController {
  constructor(private readonly applications: HustlerApplicationService) {}

  @Get()
  getMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.applications.getMine(identity);
  }

  @Put()
  saveDraft(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SaveHustlerApplicationInput
  ) {
    return this.applications.saveDraft(identity, body);
  }

  @Post("proofs")
  addProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: AddHustlerProofInput
  ) {
    return this.applications.addProof(identity, body);
  }

  @Delete("proofs/:proofId")
  removeProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("proofId") proofId: string
  ) {
    return this.applications.removeProof(identity, proofId);
  }

  @Post("submit")
  submit(@CurrentIdentity() identity: AuthIdentity) {
    return this.applications.submit(identity);
  }
}
