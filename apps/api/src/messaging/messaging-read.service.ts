import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface MessagingReadPaginationInput {
  cursor?: unknown;
  limit?: unknown;
  afterCreatedAt?: unknown;
  afterId?: unknown;
}

const participantUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  location: true,
  emailVerified: true,
  phoneVerified: true,
  professionalProfile: {
    select: {
      headline: true,
      primarySkill: true,
      category: true,
      status: true
    }
  }
} satisfies Prisma.UserSelect;

const messageSelect = {
  id: true,
  conversationId: true,
  senderId: true,
  text: true,
  attachmentType: true,
  attachmentStorageKey: true,
  attachmentFileName: true,
  attachmentMimeType: true,
  attachmentSizeBytes: true,
  contextType: true,
  contextId: true,
  createdAt: true,
  updatedAt: true,
  sender: {
    select: {
      id: true,
      displayName: true,
      username: true,
      avatarUrl: true
    }
  }
} satisfies Prisma.MessageSelect;

const conversationInclude = {
  participants: {
    include: { user: { select: participantUserSelect } }
  },
  messages: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
    select: messageSelect
  }
} satisfies Prisma.ConversationInclude;

type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type ConversationRecord = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

@Injectable()
export class MessagingReadService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(identity: AuthIdentity, input: MessagingReadPaginationInput) {
    const viewer = await this.requireUser(identity);
    const limit = this.parseLimit(input.limit, 20, 50);
    const cursor = this.decodeCursor(input.cursor, "conversation cursor");

    const conversations = await this.prisma.conversation.findMany({
      where: {
        participants: { some: { userId: viewer.id } },
        ...(cursor
          ? {
              OR: [
                { lastActivityAt: { lt: cursor.timestamp } },
                { lastActivityAt: cursor.timestamp, id: { lt: cursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: conversationInclude
    });

    const hasMore = conversations.length > limit;
    const page = hasMore ? conversations.slice(0, limit) : conversations;
    const unreadByConversation = await this.batchUnreadCounts(
      viewer.id,
      page.map((conversation) => conversation.id)
    );

    const items = page.map((conversation) =>
      this.serializeConversation(
        conversation,
        viewer.id,
        unreadByConversation.get(conversation.id) ?? 0
      )
    );

    const last = page.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? this.encodeCursor(last.lastActivityAt, last.id)
        : null,
      hasMore
    };
  }

  async getConversation(identity: AuthIdentity, conversationId: string) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(conversationId, "conversationId");

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id,
        participants: { some: { userId: viewer.id } }
      },
      include: conversationInclude
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    const participant = conversation.participants.find((item) => item.userId === viewer.id);
    if (!participant) throw new NotFoundException("Conversation participant not found");

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: id,
        senderId: { not: viewer.id },
        ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {})
      }
    });

    return this.serializeConversation(conversation, viewer.id, unreadCount);
  }

  async listMessages(
    identity: AuthIdentity,
    conversationId: string,
    input: MessagingReadPaginationInput
  ) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(conversationId, "conversationId");
    await this.requireParticipant(id, viewer.id);

    const limit = this.parseLimit(input.limit, 30, 100);
    const cursor = this.decodeCursor(input.cursor, "message cursor");
    const after = this.parseAfter(input.afterCreatedAt, input.afterId);

    if (cursor && after) {
      throw new BadRequestException("Use either cursor or afterCreatedAt/afterId, not both");
    }

    if (after) {
      const messages = await this.prisma.message.findMany({
        where: {
          conversationId: id,
          OR: [
            { createdAt: { gt: after.timestamp } },
            { createdAt: after.timestamp, id: { gt: after.id } }
          ]
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: limit + 1,
        select: messageSelect
      });

      const hasMore = messages.length > limit;
      const page = hasMore ? messages.slice(0, limit) : messages;
      return {
        items: page.map((message) => this.serializeMessage(message)),
        nextCursor: null,
        hasMore
      };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: id,
        ...(cursor
          ? {
              OR: [
                { createdAt: { lt: cursor.timestamp } },
                { createdAt: cursor.timestamp, id: { lt: cursor.id } }
              ]
            }
          : {})
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      select: messageSelect
    });

    const hasMore = messages.length > limit;
    const pageDescending = hasMore ? messages.slice(0, limit) : messages;
    const oldest = pageDescending.at(-1);

    return {
      items: pageDescending.reverse().map((message) => this.serializeMessage(message)),
      nextCursor: hasMore && oldest
        ? this.encodeCursor(oldest.createdAt, oldest.id)
        : null,
      hasMore
    };
  }

  private async batchUnreadCounts(viewerUserId: string, conversationIds: string[]) {
    const counts = new Map<string, number>();
    if (conversationIds.length === 0) return counts;

    const rows = await this.prisma.$queryRaw<Array<{ conversationId: string; unreadCount: bigint }>>(
      Prisma.sql`
        SELECT
          m."conversationId" AS "conversationId",
          COUNT(*)::bigint AS "unreadCount"
        FROM "Message" m
        INNER JOIN "ConversationParticipant" cp
          ON cp."conversationId" = m."conversationId"
          AND cp."userId" = ${viewerUserId}
        WHERE m."conversationId" IN (${Prisma.join(conversationIds)})
          AND m."senderId" <> ${viewerUserId}
          AND (cp."lastReadAt" IS NULL OR m."createdAt" > cp."lastReadAt")
        GROUP BY m."conversationId"
      `
    );

    for (const row of rows) counts.set(row.conversationId, Number(row.unreadCount));
    return counts;
  }

  private serializeConversation(
    conversation: ConversationRecord,
    viewerUserId: string,
    unreadCount: number
  ) {
    const viewerParticipant = conversation.participants.find((item) => item.userId === viewerUserId);
    const other = conversation.participants.find((item) => item.userId !== viewerUserId);

    return {
      id: conversation.id,
      type: conversation.type,
      lastActivityAt: conversation.lastActivityAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      viewer: {
        userId: viewerUserId,
        lastReadAt: viewerParticipant?.lastReadAt ?? null,
        unreadCount
      },
      otherParticipant: other ? this.serializeParticipant(other.user) : null,
      lastMessage: conversation.messages[0]
        ? this.serializeMessage(conversation.messages[0])
        : null
    };
  }

  private serializeParticipant(user: Prisma.UserGetPayload<{ select: typeof participantUserSelect }>) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      location: user.location,
      verified: user.emailVerified || user.phoneVerified,
      professionalProfile: user.professionalProfile
        ? {
            headline: user.professionalProfile.headline,
            primarySkill: user.professionalProfile.primarySkill,
            category: user.professionalProfile.category,
            status: user.professionalProfile.status
          }
        : null
    };
  }

  private serializeMessage(message: MessageRecord) {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      attachment: message.attachmentType && message.attachmentStorageKey
        ? {
            type: message.attachmentType,
            storageKey: message.attachmentStorageKey,
            fileName: message.attachmentFileName,
            mimeType: message.attachmentMimeType,
            sizeBytes: message.attachmentSizeBytes
          }
        : null,
      context: message.contextType && message.contextId
        ? {
            type: message.contextType,
            id: message.contextId,
            url: this.contextUrl(message.contextType, message.contextId)
          }
        : null,
      sender: message.sender,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private async requireParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: { conversationId, userId }
      },
      select: { conversationId: true }
    });
    if (!participant) throw new NotFoundException("Conversation not found");
    return participant;
  }

  private contextUrl(type: string, id: string) {
    if (type === "POST") return `/posts/${id}`;
    if (type === "SERVICE") return `/services/${id}`;
    return `/products/${id}`;
  }

  private parseLimit(value: unknown, fallback: number, maximum: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
      throw new BadRequestException(`limit must be an integer between 1 and ${maximum}`);
    }
    return parsed;
  }

  private encodeCursor(timestamp: Date, id: string) {
    return Buffer.from(JSON.stringify({ timestamp: timestamp.toISOString(), id })).toString("base64url");
  }

  private decodeCursor(value: unknown, field: string): { timestamp: Date; id: string } | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} is invalid`);

    try {
      const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
        timestamp?: unknown;
        id?: unknown;
      };
      if (typeof decoded.timestamp !== "string" || typeof decoded.id !== "string") {
        throw new Error("invalid cursor");
      }
      const timestamp = new Date(decoded.timestamp);
      if (Number.isNaN(timestamp.getTime()) || !decoded.id.trim()) throw new Error("invalid cursor");
      return { timestamp, id: decoded.id };
    } catch {
      throw new BadRequestException(`${field} is invalid`);
    }
  }

  private parseAfter(createdAtValue: unknown, idValue: unknown) {
    const hasCreatedAt = createdAtValue !== undefined && createdAtValue !== null && createdAtValue !== "";
    const hasId = idValue !== undefined && idValue !== null && idValue !== "";
    if (!hasCreatedAt && !hasId) return null;
    if (!hasCreatedAt || !hasId || typeof createdAtValue !== "string" || typeof idValue !== "string") {
      throw new BadRequestException("afterCreatedAt and afterId must be provided together");
    }

    const timestamp = new Date(createdAtValue);
    const id = this.requiredId(idValue, "afterId");
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException("afterCreatedAt must be a valid timestamp");
    }
    return { timestamp, id };
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw new BadRequestException(`${field} must be a valid identifier`);
    }
    return value.trim();
  }
}
