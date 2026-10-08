import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { MarketplaceModerationService } from "./marketplace-moderation.service";

@Controller("admin/operations/moderation")
@UseGuards(AuthGuard, AdminGuard)
export class MarketplaceModerationController {
  constructor(private readonly moderation: MarketplaceModerationService) {}

  @Get("overview")
  overview() {
    return this.moderation.overview();
  }

  @Get("content")
  list(
    @Query("type") type: string,
    @Query("state") state?: string,
    @Query("limit") limit?: string
  ) {
    return this.moderation.list(type, state, limit);
  }

  @Get(":type/:id")
  detail(@Param("type") type: string, @Param("id") id: string) {
    return this.moderation.detail(type, id);
  }

  @Post(":type/:id/hold")
  hold(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: { reason?: unknown }
  ) {
    return this.moderation.hold(identity, type, id, body);
  }

  @Post(":type/:id/release")
  release(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("type") type: string,
    @Param("id") id: string,
    @Body() body: { reason?: unknown }
  ) {
    return this.moderation.release(identity, type, id, body);
  }
}
