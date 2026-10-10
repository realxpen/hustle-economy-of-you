import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { BookingStatus, NotificationKind, OrderStatus, Prisma } from "@prisma/client";

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
          CASE
            WHEN n.kind = 'MESSAGE'::"NotificationKind" THEN 'thread:' || n.href
            WHEN n.kind = 'SOCIAL'::"NotificationKind" AND n.href LIKE '/posts/%'
              THEN 'post:' || n.href
            ELSE 'notification:' || n.id
          END AS "groupKey",
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
        GROUP BY CASE
          WHEN n.kind = 'MESSAGE'::"NotificationKind" THEN 'thread:' || n.href
          WHEN n.kind = 'SOCIAL'::"NotificationKind" AND n.href LIKE '/posts/%'
            THEN 'post:' || n.href
          ELSE 'notification:' || n.id
        END
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
        ...(selected.kind === NotificationKind.MESSAGE ||
          (selected.kind === NotificationKind.SOCIAL && selected.href.startsWith("/posts/"))
          ? {
              kind: selected.kind,
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

  /**
   * Record a Booking status change only after the authoritative state update
   * has succeeded. Called inside the caller's transaction, never by a browser.
   * The actor may be an Agent; the affected principal remains the Hustler.
   */
  async recordBookingStatus(
    tx: Prisma.TransactionClient,
    booking: { id: string; clientUserId: string; hustlerUserId: string },
    status: BookingStatus,
    actorUserId?: string
  ) {
    const recipientId =
      status === BookingStatus.REQUESTED ||
      status === BookingStatus.FUNDED
        ? booking.hustlerUserId
        : status === BookingStatus.CANCELLED
          ? actorUserId === booking.clientUserId
            ? booking.hustlerUserId
            : booking.clientUserId
          : booking.clientUserId;
    const texts: Partial<Record<BookingStatus, [string, string]>> = {
      REQUESTED: ["New booking request", "A client has requested your service."],
      ACCEPTED: ["Booking accepted", "Your booking request was accepted."],
      PAYMENT_PENDING: ["Booking accepted", "Your booking was accepted and is awaiting payment."],
      DECLINED: ["Booking declined", "Your booking request was declined."],
      CANCELLED: ["Booking cancelled", "A booking involving you was cancelled."],
      FUNDED: ["Booking funded", "Your booking has been funded through the payment system."],
      IN_PROGRESS: ["Booking started", "Work on your booking has started."],
      COMPLETED: ["Booking completed", "The Hustler marked your booking completed."]
    };
    const copy = texts[status];
    if (!copy || recipientId === actorUserId) return;
    await tx.notification.createMany({
      data: [{
        recipientUserId: recipientId,
        eventKey: `booking:${booking.id}:${status}`,
        kind: NotificationKind.BOOKING,
        title: copy[0],
        body: copy[1],
        href: `/bookings/${encodeURIComponent(booking.id)}`
      }],
      skipDuplicates: true
    });
  }

  /** This is a read-only side-effect of an authorized Order transition. */
  async recordOrderStatus(
    tx: Prisma.TransactionClient,
    order: { id: string; buyerUserId: string; sellerUserId: string },
    status: OrderStatus,
    actorUserId?: string
  ) {
    const recipientId = status === OrderStatus.PENDING ||
        status === OrderStatus.PAID ||
        status === OrderStatus.COMPLETED
      ? order.sellerUserId
      : status === OrderStatus.CANCELLED
        ? actorUserId === order.buyerUserId ? order.sellerUserId : order.buyerUserId
        : order.buyerUserId;
    const texts: Partial<Record<OrderStatus, [string, string]>> = {
      PENDING: ["New order received", "A buyer placed an order for your products."],
      PAID: ["Order payment confirmed", "The payment system confirmed an order's payment."],
      PROCESSING: ["Order being prepared", "The seller is preparing your order."],
      SHIPPED: ["Order shipped", "Your order has been shipped."],
      DELIVERED: ["Order delivered", "The seller marked your order as delivered."],
      COMPLETED: ["Order completed", "The buyer confirmed your order is complete."],
      CANCELLED: ["Order cancelled", "An order involving you was cancelled."]
    };
    const copy = texts[status];
    if (!copy || recipientId === actorUserId) return;
    await tx.notification.createMany({
      data: [{
        recipientUserId: recipientId,
        eventKey: `order:${order.id}:${status}`,
        kind: NotificationKind.ORDER,
        title: copy[0],
        body: copy[1],
        href: `/orders/${encodeURIComponent(order.id)}`
      }],
      skipDuplicates: true
    });
  }

  /**
   * Record capability application decisions only after the corresponding
   * authoritative reviewer state transition. Never include proof documents,
   * notes or sensitive rejection details in the notification body.
   */
  async recordCapabilityApplication(
    tx: Prisma.TransactionClient,
    input: {
      applicationId: string;
      applicantUserId: string;
      capability: "HUSTLER" | "AGENT";
      status: "UNDER_REVIEW" | "APPROVED" | "REJECTED";
    }
  ) {
    const label = input.capability === "HUSTLER" ? "Hustler" : "Agent";
    const details = {
      UNDER_REVIEW: [`${label} application in review`, "Your application is being reviewed. We'll let you know when there's a decision."],
      APPROVED: [`${label} application approved`, `Your ${label} capability has been activated on your Hustle account.`],
      REJECTED: [`${label} application update`, "Your application was not approved. Open the application page for the details."]
    } as const;
    const [title, body] = details[input.status];
    await tx.notification.createMany({
      data: [{
        recipientUserId: input.applicantUserId,
        eventKey: `application:${input.capability.toLowerCase()}:${input.applicationId}:${input.status}`,
        kind: NotificationKind.APPLICATION,
        title,
        body,
        href: input.capability === "HUSTLER" ? "/hustler-application" : "/agent-application"
      }],
      skipDuplicates: true
    });
  }

  /**
   * A Live start is authoritative only after the DRAFT→LIVE compare-and-swap.
   * INSERT…SELECT avoids loading the host's follow graph into API memory and
   * remains in the same database transaction as the status change. Existing
   * blocks in either direction exclude that follower at notification time.
   */
  async recordLiveStarted(
    tx: Prisma.TransactionClient,
    input: { liveId: string; hostUserId: string }
  ) {
    await tx.$executeRaw`
      INSERT INTO "Notification"
        ("id", "recipientUserId", "eventKey", "kind", "title", "body", "href", "createdAt")
      SELECT
        gen_random_uuid()::text, f."followerId",
        ${`live:started:${input.liveId}`},
        'LIVE'::"NotificationKind",
        'A Hustler you follow is live',
        'Join their Live session to see what they are making and offering.',
        ${`/live/${encodeURIComponent(input.liveId)}`},
        CURRENT_TIMESTAMP
      FROM "UserFollow" AS f
      WHERE f."followingId" = ${input.hostUserId}
        AND f."followerId" <> ${input.hostUserId}
        AND NOT EXISTS (
          SELECT 1 FROM "UserBlock" AS b
          WHERE (b."blockerUserId" = ${input.hostUserId} AND b."blockedUserId" = f."followerId")
             OR (b."blockedUserId" = ${input.hostUserId} AND b."blockerUserId" = f."followerId")
        )
      ON CONFLICT ("recipientUserId", "eventKey") DO NOTHING
    `;
  }

  /** Only the canonical transaction-backed PUBLISHED Review triggers this. */
  async recordVerifiedReview(
    tx: Prisma.TransactionClient,
    review: {
      id: string;
      revieweeUserId: string;
      reviewerUserId: string;
      subjectType: "BOOKING" | "ORDER";
      subjectId: string;
    }
  ) {
    if (review.revieweeUserId === review.reviewerUserId) return;
    const context = review.subjectType === "BOOKING" ? "booking" : "order";
    await tx.notification.createMany({
      data: [{
        recipientUserId: review.revieweeUserId,
        eventKey: `review:verified:${review.id}`,
        kind: NotificationKind.REVIEW,
        title: "New verified review",
        body: `A transaction-backed review was published for your ${context}.`,
        href: `/${context}s/${encodeURIComponent(review.subjectId)}`
      }],
      skipDuplicates: true
    });
  }

  /**
   * Meaningful social activity is written with the authoritative Post/Follow
   * mutation. Comments are grouped per Post in the read model to avoid spam;
   * follower notifications are unique per follower/recipient pair.
   */
  async recordNewFollower(
    tx: Prisma.TransactionClient,
    input: { followerUserId: string; followedUserId: string; followerUsername: string | null }
  ) {
    if (input.followerUserId === input.followedUserId) return;
    await tx.notification.createMany({
      data: [{
        recipientUserId: input.followedUserId,
        eventKey: `social:follow:${input.followerUserId}`,
        kind: NotificationKind.SOCIAL,
        title: "New follower",
        body: "Someone new is following your work on Hustle.",
        href: input.followerUsername
          ? `/u/${encodeURIComponent(input.followerUsername)}`
          : "/notifications"
      }],
      skipDuplicates: true
    });
  }

  async recordPostComment(
    tx: Prisma.TransactionClient,
    input: { commentId: string; postId: string; authorUserId: string; ownerUserId: string; replyToUserId: string | null }
  ) {
    const recipients = new Map<string, string>();
    if (input.ownerUserId !== input.authorUserId) {
      recipients.set(input.ownerUserId, "New comment on your post");
    }
    if (input.replyToUserId && input.replyToUserId !== input.authorUserId) {
      recipients.set(input.replyToUserId, "New reply to your comment");
    }
    if (!recipients.size) return;
    await tx.notification.createMany({
      data: [...recipients.entries()].map(([recipientUserId, title]) => ({
        recipientUserId,
        eventKey: `social:comment:${input.commentId}`,
        kind: NotificationKind.SOCIAL,
        title,
        body: "A conversation about demonstrated work has a new contribution.",
        href: `/posts/${encodeURIComponent(input.postId)}`
      })),
      skipDuplicates: true
    });
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
