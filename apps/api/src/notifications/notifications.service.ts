import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationKind, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

type PageCursor = { createdAt: Date; id: string };

const notificationSelect = {
  id: true,
  kind: true,
  title: true,
  body: true,
  href: true,
  readAt: true,
  createdAt: true
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async userId(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account not synchronized");
    return user.id;
  }

  private pagination(limitValue: unknown, cursorValue: unknown) {
    const limit = limitValue === undefined ? 20 : Number(limitValue);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException("limit must be between 1 and 50");
    }
    let cursor: PageCursor | null = null;
    if (cursorValue !== undefined && cursorValue !== null && cursorValue !== "") {
      if (typeof cursorValue !== "string" || cursorValue.length > 400) {
        throw new BadRequestException("Invalid notification cursor");
      }
      try {
        const parsed = JSON.parse(Buffer.from(cursorValue, "base64url").toString("utf8")) as {
          createdAt?: unknown;
          id?: unknown;
        };
        if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string" ||
            parsed.id.length > 200 || !parsed.id.trim()) throw new Error("bad cursor");
        const date = new Date(parsed.createdAt);
        if (Number.isNaN(date.getTime())) throw new Error("bad date");
        cursor = { createdAt: date, id: parsed.id };
      } catch {
        throw new BadRequestException("Invalid notification cursor");
      }
    }
    return { limit, cursor };
  }

  async list(identity: AuthIdentity, query: { limit?: unknown; cursor?: unknown }) {
    const recipientUserId = await this.userId(identity);
    const { limit, cursor } = this.pagination(query.limit, query.cursor);
    const rows = await this.prisma.notification.findMany({
      where: {
        recipientUserId,
        ...(cursor ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, id: { lt: cursor.id } }
          ]
        } : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: notificationSelect
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString("base64url")
        : null,
      hasMore
    };
  }

  async unreadCount(identity: AuthIdentity) {
    const recipientUserId = await this.userId(identity);
    return {
      count: await this.prisma.notification.count({
        where: { recipientUserId, readAt: null }
      })
    };
  }

  async markRead(identity: AuthIdentity, notificationId: string) {
    const recipientUserId = await this.userId(identity);
    if (!notificationId || notificationId.length > 200) throw new BadRequestException("Invalid notification id");
    const result = await this.prisma.notification.updateMany({
      where: { id: notificationId, recipientUserId, readAt: null },
      data: { readAt: new Date() }
    });
    if (!result.count) {
      const exists = await this.prisma.notification.findFirst({
        where: { id: notificationId, recipientUserId }, select: { id: true }
      });
      if (!exists) throw new NotFoundException("Notification not found");
    }
    return { id: notificationId, read: true };
  }

  async markAllRead(identity: AuthIdentity) {
    const recipientUserId = await this.userId(identity);
    const result = await this.prisma.notification.updateMany({
      where: { recipientUserId, readAt: null },
      data: { readAt: new Date() }
    });
    return { updatedCount: result.count };
  }

  // Called within the authoritative message write transaction. Nothing is delivered
  // externally and the sender never receives a notification for their own message.
  async recordDirectMessage(
    tx: Prisma.TransactionClient,
    message: { id: string; conversationId: string; senderId: string }
  ) {
    const recipients = await tx.conversationParticipant.findMany({
      where: { conversationId: message.conversationId, userId: { not: message.senderId } },
      select: { userId: true }
    });
    if (recipients.length === 0) return;
    await tx.notification.createMany({
      data: recipients.map((recipient) => ({
        recipientUserId: recipient.userId,
        eventKey: `message:${message.id}`,
        kind: NotificationKind.MESSAGE,
        title: "New message",
        body: "You have a new message waiting on Hustle.",
        href: `/messages/${encodeURIComponent(message.conversationId)}`
      })),
      skipDuplicates: true
    });
  }
}
