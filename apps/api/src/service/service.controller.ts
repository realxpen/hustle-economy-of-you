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
import { Capability } from "@prisma/client";

import { AuthGuard } from "../auth/auth.guard";
import { CapabilityGuard } from "../auth/capability.guard";
import { RequireCapability } from "../auth/capability.decorator";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { ServiceService, type SaveServiceInput } from "./service.service";

@Controller("services")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.HUSTLER)
export class OwnerServiceController {
  constructor(private readonly services: ServiceService) {}

  @Get("mine")
  listMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.services.listMine(identity);
  }

  @Post()
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: SaveServiceInput
  ) {
    return this.services.create(identity, body);
  }

  @Get("mine/:serviceId")
  getMine(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("serviceId") serviceId: string
  ) {
    return this.services.getMine(identity, serviceId);
  }

  @Put(":serviceId")
  save(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("serviceId") serviceId: string,
    @Body() body: SaveServiceInput
  ) {
    return this.services.save(identity, serviceId, body);
  }

  @Post(":serviceId/publish")
  publish(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("serviceId") serviceId: string
  ) {
    return this.services.publish(identity, serviceId);
  }

  @Post(":serviceId/pause")
  pause(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("serviceId") serviceId: string
  ) {
    return this.services.pause(identity, serviceId);
  }

  @Delete(":serviceId")
  remove(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("serviceId") serviceId: string
  ) {
    return this.services.remove(identity, serviceId);
  }
}

@Controller("services")
export class PublicServiceController {
  constructor(private readonly services: ServiceService) {}

  @Get(":serviceId")
  getPublic(@Param("serviceId") serviceId: string) {
    return this.services.getPublic(serviceId);
  }
}
