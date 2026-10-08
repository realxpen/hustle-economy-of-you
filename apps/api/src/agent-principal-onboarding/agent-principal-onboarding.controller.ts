import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards
} from "@nestjs/common";
import { Capability } from "@prisma/client";

import { AuthGuard } from "../auth/auth.guard";
import { CapabilityGuard } from "../auth/capability.guard";
import { RequireCapability } from "../auth/capability.decorator";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import {
  AgentPrincipalOnboardingService,
  type AddDelegatedHustlerProofInput,
  type SaveDelegatedHustlerApplicationInput,
  type UpdateDelegatedIdentityInput
} from "./agent-principal-onboarding.service";

@Controller("agent-principal-onboarding/:principalUserId")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.AGENT)
export class AgentPrincipalOnboardingController {
  constructor(private readonly onboarding: AgentPrincipalOnboardingService) {}

  @Get()
  get(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.onboarding.get(identity, principalUserId);
  }

  @Patch("identity")
  updateIdentity(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: UpdateDelegatedIdentityInput
  ) {
    return this.onboarding.updateIdentity(identity, principalUserId, body);
  }

  @Put("hustler-application")
  saveHustlerApplication(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: SaveDelegatedHustlerApplicationInput
  ) {
    return this.onboarding.saveHustlerApplication(identity, principalUserId, body);
  }

  @Post("hustler-application/proofs")
  addProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Body() body: AddDelegatedHustlerProofInput
  ) {
    return this.onboarding.addProof(identity, principalUserId, body);
  }

  @Delete("hustler-application/proofs/:proofId")
  removeProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string,
    @Param("proofId") proofId: string
  ) {
    return this.onboarding.removeProof(identity, principalUserId, proofId);
  }

  @Post("hustler-application/submit")
  submitHustlerApplication(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("principalUserId") principalUserId: string
  ) {
    return this.onboarding.submitHustlerApplication(identity, principalUserId);
  }
}
