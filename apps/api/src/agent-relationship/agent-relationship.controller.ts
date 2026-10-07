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
  AgentRelationshipService,
  type CreateAgentInvitationInput,
  type UpdateAgentPermissionsInput
} from "./agent-relationship.service";

@Controller("agent-relationships/hustler")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.HUSTLER)
export class HustlerAgentRelationshipController {
  constructor(private readonly relationships: AgentRelationshipService) {}

  @Get()
  list(@CurrentIdentity() identity: AuthIdentity) {
    return this.relationships.listForHustler(identity);
  }

  @Post("invitations")
  invite(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: CreateAgentInvitationInput
  ) {
    return this.relationships.invite(identity, body);
  }

  @Put(":relationshipId/permissions")
  updatePermissions(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("relationshipId") relationshipId: string,
    @Body() body: UpdateAgentPermissionsInput
  ) {
    return this.relationships.updatePermissions(identity, relationshipId, body);
  }

  @Post(":relationshipId/revoke")
  revoke(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("relationshipId") relationshipId: string
  ) {
    return this.relationships.revokeAsHustler(identity, relationshipId);
  }
}

@Controller("agent-relationships/agent")
@UseGuards(AuthGuard, CapabilityGuard)
@RequireCapability(Capability.AGENT)
export class AgentRelationshipController {
  constructor(private readonly relationships: AgentRelationshipService) {}

  @Get()
  list(@CurrentIdentity() identity: AuthIdentity) {
    return this.relationships.listForAgent(identity);
  }

  @Post(":relationshipId/accept")
  accept(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("relationshipId") relationshipId: string
  ) {
    return this.relationships.accept(identity, relationshipId);
  }

  @Post(":relationshipId/decline")
  decline(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("relationshipId") relationshipId: string
  ) {
    return this.relationships.decline(identity, relationshipId);
  }

  @Post(":relationshipId/leave")
  leave(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("relationshipId") relationshipId: string
  ) {
    return this.relationships.leave(identity, relationshipId);
  }
}
