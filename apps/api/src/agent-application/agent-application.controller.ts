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
  AgentApplicationService,
  type AddAgentProofInput,
  type SaveAgentApplicationInput
} from "./agent-application.service";

@Controller("agent-application")
@UseGuards(AuthGuard)
export class AgentApplicationController {
  constructor(private readonly applications: AgentApplicationService) {}

  @Get()
  getMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.applications.getMine(identity);
  }

  @Put()
  saveDraft(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SaveAgentApplicationInput
  ) {
    return this.applications.saveDraft(identity, body);
  }

  @Post("proofs")
  addProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: AddAgentProofInput
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
