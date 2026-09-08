import {
  Body,
  Controller,
  Get,
  Param,
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
  ProfessionalProfileService,
  type SaveProfessionalProfileInput
} from "./professional-profile.service";

@Controller("professional-profile")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.HUSTLER)
export class ProfessionalProfileController {
  constructor(private readonly profiles: ProfessionalProfileService) {}

  @Get()
  getMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.profiles.getMine(identity);
  }

  @Put()
  save(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SaveProfessionalProfileInput
  ) {
    return this.profiles.save(identity, body);
  }

  @Post("publish")
  publish(@CurrentIdentity() identity: AuthIdentity) {
    return this.profiles.publish(identity);
  }

  @Post("unpublish")
  unpublish(@CurrentIdentity() identity: AuthIdentity) {
    return this.profiles.unpublish(identity);
  }
}

@Controller("profiles")
export class PublicProfessionalProfileController {
  constructor(private readonly profiles: ProfessionalProfileService) {}

  @Get(":username")
  getPublic(@Param("username") username: string) {
    return this.profiles.getPublic(username);
  }
}
