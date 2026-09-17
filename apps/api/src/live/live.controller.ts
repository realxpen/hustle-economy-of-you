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
  constructor(private readonly live: LiveService) {}

  @Get()
  listActive(@Query("limit") limit?: string) {
    return this.live.listActive(limit);
  }

  @Get("mine")
  @UseGuards(AuthGuard)
  listMine(@CurrentIdentity() identity: AuthIdentity) {
    return this.live.listMine(identity);
  }

  @Get("mine/:liveId")
  @UseGuards(AuthGuard)
  getMine(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string
  ) {
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
  update(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: UpdateLiveSessionInput
  ) {
    return this.live.update(identity, liveId, body);
  }

  @Post(":liveId/start")
  @UseGuards(AuthGuard)
  start(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string
  ) {
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
  pin(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: LivePinInput
  ) {
    return this.live.pin(identity, liveId, body);
  }

  @Post(":liveId/view")
  heartbeat(
    @Param("liveId") liveId: string,
    @Body() body: LiveViewerInput
  ) {
    return this.live.heartbeat(liveId, body);
  }

  @Get(":liveId/comments")
  listComments(@Param("liveId") liveId: string) {
    return this.live.listComments(liveId);
  }

  @Post(":liveId/comments")
  @UseGuards(AuthGuard)
  comment(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("liveId") liveId: string,
    @Body() body: LiveCommentInput
  ) {
    return this.live.comment(identity, liveId, body);
  }

  @Post(":liveId/events")
  recordEvent(
    @Param("liveId") liveId: string,
    @Body() body: LiveEventInput
  ) {
    return this.live.recordEvent(liveId, body);
  }

  @Get(":liveId")
  getPublic(@Param("liveId") liveId: string) {
    return this.live.getPublic(liveId);
  }
}
