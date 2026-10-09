import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { NotificationKind, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

type PageCursor = { createdAt: Date; id: string };

type NotificationInboxRow = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  readAt: Date | null;
  createdAt: Date;
  messageCount: number;
  unreadMessages: number;
};

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

  // Existing notification rows stay immutable as delivery evidence. The inbox
  // folds MESSAGE events by recipient + direct conversation; unrelated kinds
  // remain independent. The grouping occurs BEFORE pagination, so a thread
  // never splits into multiple cards just because it crossed a page boundary.
  async list(identity: AuthIdentity, query: { limit?: unknown; cursor?: unknown }) {
    const recipientUserId = await this.userId(identity);
    const { limit, cursor } = this.pagination(query.limit, query.cursor);
    const cursorFilter = cursor
      ? Prisma.sql`WHERE (clusters."createdAt", clusters."latestId") < (${cursor.createdAt}, ${cursor.id})`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<NotificationInboxRow[]>(Prisma.sql`
      WITH clusters AS (
        SELECT
          CASE WHEN n.kind = 'MESSAGE'::"NotificationKind"
            THEN 'thread:' || n.href ELSE 'notification:' || n.id END AS "groupKey",
          (ARRAY_AGG(n.id ORDER BY n."createdAt" DESC, n.id DESC))[1] AS "latestId",
          MAX(n."createdAt") AS "createdAt",
          COUNT(*)::integer AS "messageCount",
          (COUNT(*) FILTER (WHERE n."readAt" IS NULL))::integer AS "unreadMessages"
        FROM "Notification" n
        WHERE n."recipientUserId" = ${recipientUserId}
        GROUP BY 1
      ),
      selected AS (
        SELECT * FROM clusters
        ${cursorFilter}
        ORDER BY "createdAt" DESC, "latestId" DESC
        LIMIT ${limit + 1}
      )
      SELECT
        n.id, n.kind, n.title, n.body, n.href,
        selected."createdAt",
        CASE WHEN selected."unreadMessages" > 0 THEN NULL ELSE n."readAt" END AS "readAt",
        selected."messageCount",
        selected."unreadMessages"
      FROM selected
      JOIN "Notification" n ON n.id = selected."latestId"
      ORDER BY selected."createdAt" DESC, selected."latestId" DESC
    `);

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
    const rows = await this.prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::integer AS count
      FROM (
        SELECT 1
        FROM "Notification" n
        WHERE n."recipientUserId" = ${recipientUserId} AND n."readAt" IS NULL
        GROUP BY CASE WHEN n.kind = 'MESSAGE'::"NotificationKind"
          THEN 'thread:' || n.href ELSE 'notification:' || n.id END
      ) unread_groups
    `);
    return { count: rows[0]?.count ?? 0 };
  }

  async markRead(identity: AuthIdentity, notificationId: string) {
    const recipientUserId = await this.userId(identity);
    if (!notificationId || notificationId.length > 200) {
      throw new BadRequestException("Invalid notification id");
    }

    const selected = await this.prisma.notification.findFirst({
      where: { id: notificationId, recipientUserId },
      select: { id: true, kind: true, href: true, createdAt: true }
    });
    if (!selected) throw new NotFoundException("Notification not found");

    // Bound the update to the notification the user actually opened: a new
    // message arriving after the rendered card must remain unread.
    await this.prisma.notification.updateMany({
      where: {
        recipientUserId,
        readAt: null,
        ...(selected.kind === NotificationKind.MESSAGE
          ? {
              kind: NotificationKind.MESSAGE,
              href: selected.href,
              OR: [
                { createdAt: { lt: selected.createdAt } },
                { createdAt: selected.createdAt, id: { lte: selected.id } }
              ]
            }
          : { id: selected.id })
      },
      data: { readAt: new Date() }
    });
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
