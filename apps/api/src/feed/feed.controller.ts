import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { FeedService, type CaptureFeedEventInput } from "./feed.service";

@Controller("feed")
@UseGuards(AuthGuard)
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  listDefault(
    @CurrentIdentity() identity: AuthIdentity,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("location") location?: string
  ) {
    return this.feed.list(identity, "for-you", cursor, limit, location);
  }

  @Get(":tab")
  list(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("tab") tab: string,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string,
    @Query("location") location?: string
  ) {
    return this.feed.list(identity, tab, cursor, limit, location);
  }

  @Post("events")
  @HttpCode(202)
  capture(
    @CurrentIdentity() identity: AuthIdentity,
    @Body() body: CaptureFeedEventInput
  ) {
    return this.feed.capture(identity, body);
  }
}
