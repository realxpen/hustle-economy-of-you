import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import { AdaptiveFeatureGuard } from "./adaptive-feature.guard";
import { AdaptiveService } from "./adaptive.service";
import { AdaptiveRosterService } from "./adaptive-roster.service";
import { AdaptiveBookingOpsService } from "./adaptive-booking-ops.service";

@Controller("adaptive")
@UseGuards(AuthGuard, AdaptiveFeatureGuard)
export class AdaptiveController {
  constructor(private readonly adaptive: AdaptiveService, private readonly roster: AdaptiveRosterService,
    private readonly bookingOps: AdaptiveBookingOpsService) {}

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

  @Get("workspaces/:workspaceId/booking-operations")
  workspaceBookingOps(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") spaceId: string) {
    return this.bookingOps.workspaceBookings(identity,spaceId);
  }
  @Get("bookings/:bookingId/operations")
  myBookingOps(@CurrentIdentity() identity: AuthIdentity, @Param("bookingId") bookingId: string) {
    return this.bookingOps.myBookingSummary(identity,bookingId);
  }
  @Post("bookings/:bookingId/handover")
  clientHandover(@CurrentIdentity() identity: AuthIdentity, @Param("bookingId") bookingId: string,
    @Body() body: unknown) {
    return this.bookingOps.myHandover(identity,bookingId,body);
  }
  @Get("workspaces/:workspaceId/staffing-alerts")
  staffingAlerts(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") spaceId: string) {
    return this.bookingOps.staffingAlerts(identity,spaceId);
  }
  @Get("workspaces/:workspaceId/assignments")
  assignments(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") spaceId: string) {
    return this.bookingOps.assignments(identity,spaceId);
  }
  @Get("workspaces/:workspaceId/bookings/:bookingId/operations")
  bookingOperations(@CurrentIdentity() identity: AuthIdentity,
    @Param("workspaceId") spaceId: string,@Param("bookingId") bookingId: string) {
    return this.bookingOps.summary(identity,spaceId,bookingId);
  }
  @Post("workspaces/:workspaceId/bookings/:bookingId/assign")
  assignWorker(@CurrentIdentity() identity: AuthIdentity,
    @Param("workspaceId") spaceId: string,@Param("bookingId") bookingId: string,
    @Body() body: unknown) {
    return this.bookingOps.assign(identity,spaceId,bookingId,body);
  }
  @Post("workspaces/:workspaceId/bookings/:bookingId/handover")
  chooseItemHandover(@CurrentIdentity() identity: AuthIdentity,
    @Param("workspaceId") spaceId: string,@Param("bookingId") bookingId: string,
    @Body() body: unknown) {
    return this.bookingOps.selectHandover(identity,spaceId,bookingId,body);
  }
  @Post("workspaces/:workspaceId/bookings/:bookingId/item-progress")
  advanceItem(@CurrentIdentity() identity: AuthIdentity,
    @Param("workspaceId") spaceId: string,@Param("bookingId") bookingId: string,
    @Body() body: unknown) {
    return this.bookingOps.itemProgress(identity,spaceId,bookingId,body);
  }

  @Get("workspaces/:workspaceId/roster")
  rosterList(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") workspaceId: string) {
    return this.roster.list(identity, workspaceId);
  }
  @Patch("workspaces/:workspaceId/roster-settings")
  rosterSettings(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") workspaceId: string, @Body() body: unknown) {
    return this.roster.settings(identity, workspaceId, body);
  }
  @Post("workspaces/:workspaceId/staff")
  addStaff(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") workspaceId: string, @Body() body: unknown) {
    return this.roster.create(identity, workspaceId, body);
  }
  @Patch("workspaces/:workspaceId/staff/:staffId")
  editStaff(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") workspaceId: string,
    @Param("staffId") staffId: string, @Body() body: unknown) {
    return this.roster.update(identity, workspaceId, staffId, body);
  }
  @Post("workspaces/:workspaceId/staff/:staffId/leave")
  recordLeave(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") workspaceId: string,
    @Param("staffId") staffId: string, @Body() body: unknown) {
    return this.roster.leave(identity, workspaceId, staffId, body);
  }
  @Post("workspaces/:workspaceId/staff/:staffId/leave/:leaveId/cancel")
  cancelStaffLeave(@CurrentIdentity() identity: AuthIdentity, @Param("workspaceId") workspaceId: string,
    @Param("staffId") staffId: string, @Param("leaveId") leaveId: string) {
    return this.roster.cancelLeave(identity, workspaceId, staffId, leaveId);
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
  @Post("workspaces/:workspaceId/services/:draftId/prepare-canonical")
  prepareCanonical(@CurrentIdentity() identity: AuthIdentity,
    @Param("workspaceId") workspaceId: string, @Param("draftId") draftId: string) {
    return this.adaptive.prepareCanonicalService(identity, workspaceId, draftId);
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
