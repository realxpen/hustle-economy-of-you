import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentIdentity() identity: AuthIdentity, @Query() query: { limit?: unknown; cursor?: unknown }) {
    return this.notifications.list(identity, query);
  }

  @Get("unread-count")
  unreadCount(@CurrentIdentity() identity: AuthIdentity) {
    return this.notifications.unreadCount(identity);
  }

  @Post("read-all")
  markAllRead(@CurrentIdentity() identity: AuthIdentity) {
    return this.notifications.markAllRead(identity);
  }

  @Post(":notificationId/read")
  markRead(@CurrentIdentity() identity: AuthIdentity, @Param("notificationId") notificationId: string) {
    return this.notifications.markRead(identity, notificationId);
  }
}
