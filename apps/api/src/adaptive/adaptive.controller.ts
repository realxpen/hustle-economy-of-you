import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import { AdaptiveFeatureGuard } from "./adaptive-feature.guard";
import { AdaptiveService } from "./adaptive.service";

@Controller("adaptive")
@UseGuards(AuthGuard, AdaptiveFeatureGuard)
export class AdaptiveController {
  constructor(private readonly adaptive: AdaptiveService) {}

  @Get("blueprints")
  blueprints() { return this.adaptive.blueprints(); }

  @Get("workspaces")
  workspaces(@CurrentIdentity() user: AuthIdentity) {
    return this.adaptive.workspaces(user);
  }
  @Post("personal")
  personal(@CurrentIdentity() user: AuthIdentity) {
    return this.adaptive.provisionPersonal(user);
  }
  @Post("workspaces")
  createWorkspace(@CurrentIdentity() user: AuthIdentity, @Body() body: unknown) {
    return this.adaptive.createWorkspace(user, body);
  }

  @Get("invitations")
  invitations(@CurrentIdentity() user: AuthIdentity) {
    return this.adaptive.invitations(user);
  }
  @Post("invitations/:memberId/accept")
  accept(@CurrentIdentity() user: AuthIdentity, @Param("memberId") id: string) {
    return this.adaptive.respond(user, id, true);
  }
  @Post("invitations/:memberId/decline")
  decline(@CurrentIdentity() user: AuthIdentity, @Param("memberId") id: string) {
    return this.adaptive.respond(user, id, false);
  }

  @Get("workspaces/:workspaceId/members")
  members(@CurrentIdentity() user: AuthIdentity, @Param("workspaceId") id: string) {
    return this.adaptive.members(user, id);
  }
  @Post("workspaces/:workspaceId/invitations")
  invite(@CurrentIdentity() user: AuthIdentity, @Param("workspaceId") id: string, @Body() body: unknown) {
    return this.adaptive.invite(user, id, body);
  }
  @Post("workspaces/:workspaceId/members/:memberId/revoke")
  revoke(@CurrentIdentity() user: AuthIdentity,
    @Param("workspaceId") workspaceId: string, @Param("memberId") memberId: string) {
    return this.adaptive.revoke(user, workspaceId, memberId);
  }

  @Get("workspaces/:workspaceId/services")
  services(@CurrentIdentity() user: AuthIdentity, @Param("workspaceId") id: string) {
    return this.adaptive.services(user, id);
  }
  @Post("workspaces/:workspaceId/services")
  draftService(@CurrentIdentity() user: AuthIdentity, @Param("workspaceId") id: string,
    @Body() body: unknown) {
    return this.adaptive.draftService(user, id, body);
  }
  @Patch("workspaces/:workspaceId/services/:draftId")
  updateService(@CurrentIdentity() user: AuthIdentity,
    @Param("workspaceId") workspaceId: string, @Param("draftId") draftId: string,
    @Body() body: unknown) {
    return this.adaptive.updateServiceDraft(user, workspaceId, draftId, body);
  }
  @Post("workspaces/:workspaceId/work-drafts")
  draftWork(@CurrentIdentity() user: AuthIdentity, @Param("workspaceId") id: string,
    @Body() body: unknown) {
    return this.adaptive.draftWork(user, id, body);
  }
  @Patch("work-drafts/:workId/cancel")
  cancelDraft(@CurrentIdentity() user: AuthIdentity, @Param("workId") id: string,
    @Body() body: unknown) {
    return this.adaptive.cancelDraft(user, id, body);
  }
  @Get("work")
  work(@CurrentIdentity() user: AuthIdentity, @Query("workspaceId") scope?: string) {
    return this.adaptive.workHub(user, scope);
  }
}
