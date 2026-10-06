import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { LiveLifecycleService } from "./live-lifecycle.service";
import {
  LiveMediaService,
  type LiveMediaPresenceInput,
  type LiveMediaViewerInput
} from "./live-media.service";
import {
  LiveService,
  type CreateLiveSessionInput,
  type LiveCommentInput,
  type LiveEventInput,
  type LivePinInput,
  type LiveViewerInput,
  type UpdateLiveSessionInput
} from "./live.service";

@Controller("live")
export class LiveController {
  constructor(
    private readonly live: LiveService,
    private readonly media: LiveMediaService,
    private readonly lifecycle: LiveLifecycleService
  ) {}

  @Get()
  async listActive(@Query("limit") limit?: string) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.listActive(limit);
  }

  @Get("mine")
  @UseGuards(AuthGuard)
  async listMine(@CurrentIdentity() identity: AuthIdentity) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.listMine(identity);
  }

  @Get("mine/:liveId")
  @UseGuards(AuthGuard)
  async getMine(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.getMine(identity, liveId);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: CreateLiveSessionInput
  ) {
    return this.live.create(identity, body);
  }

  @Patch(":liveId")
  @UseGuards(AuthGuard)
  async update(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: UpdateLiveSessionInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.update(identity, liveId, body);
  }

  @Post(":liveId/start")
  @UseGuards(AuthGuard)
  async start(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.start(identity, liveId);
  }

  @Post(":liveId/end")
  @UseGuards(AuthGuard)
  end(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string
  ) {
    return this.live.end(identity, liveId);
  }

  @Post(":liveId/pin")
  @UseGuards(AuthGuard)
  async pin(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: LivePinInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.pin(identity, liveId, body);
  }

  @Post(":liveId/media/publish-token")
  @UseGuards(AuthGuard)
  async issuePublishCredential(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.media.issuePublishCredential(identity, liveId);
  }

  @Post(":liveId/media/view-token")
  async issueViewerCredential(
    @Param("liveId") liveId: string,
    @Body() body: LiveMediaViewerInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.media.issueViewerCredential(liveId, body);
  }

  @Post(":liveId/media/presence")
  @UseGuards(AuthGuard)
  async recordMediaPresence(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: LiveMediaPresenceInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.media.recordHostPresence(identity, liveId, body);
  }

  @Post(":liveId/view")
  async heartbeat(
    @Param("liveId") liveId: string,
    @Body() body: LiveViewerInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.heartbeat(liveId, body);
  }

  @Get(":liveId/comments")
  async listComments(@Param("liveId") liveId: string) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.listComments(liveId);
  }

  @Post(":liveId/comments")
  @UseGuards(AuthGuard)
  async comment(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: LiveCommentInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.comment(identity, liveId, body);
  }

  @Post(":liveId/events")
  async recordEvent(
    @Param("liveId") liveId: string,
    @Body() body: LiveEventInput
  ) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.recordEvent(liveId, body);
  }

  @Get(":liveId")
  async getPublic(@Param("liveId") liveId: string) {
    await this.lifecycle.expireStaleLiveSessions();
    return this.live.getPublic(liveId);
  }
}
