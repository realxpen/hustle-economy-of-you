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
  AgentAssistedOnboardingService,
  type AddAssistedHustlerProofInput,
  type CreateAssistedRegistrationInput,
  type SaveAssistedHustlerApplicationInput,
  type UpdateAssistedIdentityInput
} from "./agent-assisted-onboarding.service";

@Controller("agent-assisted-onboarding")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.AGENT)
export class AgentAssistedOnboardingController {
  constructor(private readonly onboarding: AgentAssistedOnboardingService) {}

  @Get()
  list(@CurrentIdentity() identity: AuthIdentity) {
    return this.onboarding.list(identity);
  }

  @Post()
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: CreateAssistedRegistrationInput
  ) {
    return this.onboarding.create(identity, body);
  }

  @Get(":registrationId")
  get(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("registrationId") registrationId: string
  ) {
    return this.onboarding.get(identity, registrationId);
  }

  @Patch(":registrationId/identity")
  updateIdentity(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("registrationId") registrationId: string,
    @Body() body: UpdateAssistedIdentityInput
  ) {
    return this.onboarding.updateIdentity(identity, registrationId, body);
  }

  @Put(":registrationId/hustler-application")
  saveHustlerApplication(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("registrationId") registrationId: string,
    @Body() body: SaveAssistedHustlerApplicationInput
  ) {
    return this.onboarding.saveHustlerApplication(identity, registrationId, body);
  }

  @Post(":registrationId/hustler-application/proofs")
  addProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("registrationId") registrationId: string,
    @Body() body: AddAssistedHustlerProofInput
  ) {
    return this.onboarding.addProof(identity, registrationId, body);
  }

  @Delete(":registrationId/hustler-application/proofs/:proofId")
  removeProof(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("registrationId") registrationId: string,
    @Param("proofId") proofId: string
  ) {
    return this.onboarding.removeProof(identity, registrationId, proofId);
  }

  @Post(":registrationId/hustler-application/submit")
  submitHustlerApplication(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("registrationId") registrationId: string
  ) {
    return this.onboarding.submitHustlerApplication(identity, registrationId);
  }
}
