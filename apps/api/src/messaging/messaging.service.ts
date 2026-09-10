import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  MessageAttachmentType,
  MessageContextType,
  PostStatus,
  ProductStatus,
  ProfessionalProfileStatus,
  ServiceStatus,
  Prisma
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface OpenDirectConversationInput {
  recipientUserId?: unknown;
}

export interface MessagingPaginationInput {
  cursor?: unknown;
  limit?: unknown;
}

export interface SendMessageInput {
  text?: unknown;
  attachmentType?: unknown;
  attachmentStorageKey?: unknown;
  attachmentFileName?: unknown;
  attachmentMimeType?: unknown;
  attachmentSizeBytes?: unknown;
  contextType?: unknown;
  contextId?: unknown;
}

export interface MarkConversationReadInput {
  messageId?: unknown;
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

type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async openDirect(identity: AuthIdentity, input: OpenDirectConversationInput) {
    const viewer = await this.requireUser(identity);
    const recipientUserId = this.requiredId(input.recipientUserId, "recipientUserId");

    if (viewer.id === recipientUserId) {
      throw new BadRequestException("You cannot start a conversation with yourself");
    }

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientUserId },
      select: { id: true }
    });
    if (!recipient) throw new NotFoundException("Recipient not found");

    const directKey = [viewer.id, recipient.id].sort().join(":");
    const existing = await this.prisma.conversation.findUnique({
      where: { directKey },
      select: { id: true }
    });

    if (existing) {
      return {
        created: false,
        conversation: await this.getConversationForUser(existing.id, viewer.id)
      };
    }

    let conversationId: string;
    try {
      const created = await this.prisma.conversation.create({
        data: {
          directKey,
          participants: {
            create: [
              { userId: viewer.id, lastReadAt: new Date() },
              { userId: recipient.id }
            ]
          }
        },
        select: { id: true }
      });
      conversationId = created.id;

      await this.prisma.systemEvent.create({
        data: {
          name: "messaging.conversation_started",
          source: "api",
          payload: {
            conversationId,
            starterUserId: viewer.id,
            recipientUserId: recipient.id
          }
        }
      });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const raced = await this.prisma.conversation.findUnique({
        where: { directKey },
        select: { id: true }
      });
      if (!raced) throw error;
      conversationId = raced.id;
    }

    return {
      created: true,
      conversation: await this.getConversationForUser(conversationId, viewer.id)
    };
  }

  async listConversations(identity: AuthIdentity, input: MessagingPaginationInput) {
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
                {
                  lastActivityAt: cursor.timestamp,
                  id: { lt: cursor.id }
                }
              ]
            }
          : {})
      },
      orderBy: [{ lastActivityAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        participants: {
          include: { user: { select: participantUserSelect } }
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: messageSelect
        }
      }
    });

    const hasMore = conversations.length > limit;
    const page = hasMore ? conversations.slice(0, limit) : conversations;
    const items = await Promise.all(
      page.map(async (conversation) => {
        const participant = conversation.participants.find((item) => item.userId === viewer.id);
        if (!participant) throw new NotFoundException("Conversation participant not found");

        const unreadCount = await this.prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: viewer.id },
            ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {})
          }
        });

        return this.serializeConversation(conversation, viewer.id, unreadCount);
      })
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
    return this.getConversationForUser(this.requiredId(conversationId, "conversationId"), viewer.id);
  }

  async listMessages(
    identity: AuthIdentity,
    conversationId: string,
    input: MessagingPaginationInput
  ) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(conversationId, "conversationId");
    await this.requireParticipant(id, viewer.id);

    const limit = this.parseLimit(input.limit, 30, 100);
    const cursor = this.decodeCursor(input.cursor, "message cursor");

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

  async sendMessage(
    identity: AuthIdentity,
    conversationId: string,
    input: SendMessageInput
  ) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(conversationId, "conversationId");
    await this.requireParticipant(id, viewer.id);

    const text = this.optionalText(input.text, "text", 4000);
    const attachment = this.parseAttachment(id, input);
    const context = await this.parseAndValidateContext(input.contextType, input.contextId);

    if (!text && !attachment && !context) {
      throw new BadRequestException("A message requires text, an attachment, or context");
    }

    const now = new Date();
    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: id,
          senderId: viewer.id,
          text,
          ...(attachment ?? {}),
          contextType: context?.type ?? null,
          contextId: context?.id ?? null
        },
        select: messageSelect
      }),
      this.prisma.conversation.update({
        where: { id },
        data: { lastActivityAt: now },
        select: { id: true }
      }),
      this.prisma.conversationParticipant.update({
        where: {
          conversationId_userId: {
            conversationId: id,
            userId: viewer.id
          }
        },
        data: { lastReadAt: now },
        select: { conversationId: true }
      })
    ]);

    await this.prisma.systemEvent.create({
      data: {
        name: "messaging.message_sent",
        source: "api",
        payload: {
          conversationId: id,
          messageId: message.id,
          senderUserId: viewer.id,
          hasText: Boolean(text),
          attachmentType: attachment?.attachmentType ?? null,
          contextType: context?.type ?? null,
          contextId: context?.id ?? null
        }
      }
    });

    return this.serializeMessage(message);
  }

  async markRead(
    identity: AuthIdentity,
    conversationId: string,
    input: MarkConversationReadInput
  ) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(conversationId, "conversationId");
    const participant = await this.requireParticipant(id, viewer.id);
    const requestedMessageId = this.optionalId(input.messageId, "messageId");

    const targetMessage = requestedMessageId
      ? await this.prisma.message.findFirst({
          where: { id: requestedMessageId, conversationId: id },
          select: { id: true, createdAt: true }
        })
      : await this.prisma.message.findFirst({
          where: { conversationId: id },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, createdAt: true }
        });

    if (requestedMessageId && !targetMessage) {
      throw new NotFoundException("Message not found in this conversation");
    }

    const candidate = targetMessage?.createdAt ?? new Date();
    const nextReadAt = participant.lastReadAt && participant.lastReadAt > candidate
      ? participant.lastReadAt
      : candidate;

    await this.prisma.conversationParticipant.update({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: viewer.id
        }
      },
      data: { lastReadAt: nextReadAt }
    });

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId: id,
        senderId: { not: viewer.id },
        createdAt: { gt: nextReadAt }
      }
    });

    return {
      conversationId: id,
      lastReadAt: nextReadAt,
      throughMessageId: targetMessage?.id ?? null,
      unreadCount
    };
  }

  async recordContextOpened(
    identity: AuthIdentity,
    conversationId: string,
    messageId: string
  ) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(conversationId, "conversationId");
    const normalizedMessageId = this.requiredId(messageId, "messageId");
    await this.requireParticipant(id, viewer.id);

    const message = await this.prisma.message.findFirst({
      where: { id: normalizedMessageId, conversationId: id },
      select: { id: true, contextType: true, contextId: true }
    });
    if (!message) throw new NotFoundException("Message not found in this conversation");
    if (!message.contextType || !message.contextId) {
      throw new BadRequestException("Message has no context attachment");
    }

    await this.prisma.systemEvent.create({
      data: {
        name: "messaging.context_opened",
        source: "web",
        payload: {
          conversationId: id,
          messageId: message.id,
          viewerUserId: viewer.id,
          contextType: message.contextType,
          contextId: message.contextId
        }
      }
    });

    return { recorded: true };
  }

  private async getConversationForUser(conversationId: string, viewerUserId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId: viewerUserId } }
      },
      include: {
        participants: {
          include: { user: { select: participantUserSelect } }
        },
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: messageSelect
        }
      }
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    const participant = conversation.participants.find((item) => item.userId === viewerUserId);
    if (!participant) throw new NotFoundException("Conversation participant not found");

    const unreadCount = await this.prisma.message.count({
      where: {
        conversationId,
        senderId: { not: viewerUserId },
        ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {})
      }
    });

    return this.serializeConversation(conversation, viewerUserId, unreadCount);
  }

  private serializeConversation(
    conversation: {
      id: string;
      type: string;
      lastActivityAt: Date;
      createdAt: Date;
      updatedAt: Date;
      participants: Array<{
        userId: string;
        joinedAt: Date;
        lastReadAt: Date | null;
        user: Prisma.UserGetPayload<{ select: typeof participantUserSelect }>;
      }>;
      messages: MessageRecord[];
    },
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
      select: { conversationId: true, userId: true, lastReadAt: true }
    });
    if (!participant) throw new NotFoundException("Conversation not found");
    return participant;
  }

  private async parseAndValidateContext(typeValue: unknown, idValue: unknown) {
    const type = this.optionalContextType(typeValue);
    const id = this.optionalId(idValue, "contextId");

    if (!type && !id) return null;
    if (!type || !id) {
      throw new BadRequestException("contextType and contextId must be provided together");
    }

    if (type === MessageContextType.POST) {
      const post = await this.prisma.post.findFirst({
        where: {
          id,
          status: PostStatus.PUBLISHED,
          professionalProfile: {
            is: {
              status: ProfessionalProfileStatus.PUBLISHED,
              user: {
                capabilities: {
                  some: { capability: "HUSTLER", status: "ACTIVE" }
                }
              }
            }
          }
        },
        select: { id: true }
      });
      if (!post) throw new NotFoundException("Post context is not currently available");
    }

    if (type === MessageContextType.SERVICE) {
      const service = await this.prisma.service.findFirst({
        where: {
          id,
          status: ServiceStatus.PUBLISHED,
          professionalProfile: {
            is: {
              status: ProfessionalProfileStatus.PUBLISHED,
              user: {
                capabilities: {
                  some: { capability: "HUSTLER", status: "ACTIVE" }
                }
              }
            }
          }
        },
        select: { id: true }
      });
      if (!service) throw new NotFoundException("Service context is not currently available");
    }

    if (type === MessageContextType.PRODUCT) {
      const product = await this.prisma.product.findFirst({
        where: {
          id,
          status: ProductStatus.PUBLISHED,
          professionalProfile: {
            is: {
              status: ProfessionalProfileStatus.PUBLISHED,
              user: {
                capabilities: {
                  some: { capability: "HUSTLER", status: "ACTIVE" }
                }
              }
            }
          }
        },
        select: { id: true }
      });
      if (!product) throw new NotFoundException("Product context is not currently available");
    }

    return { type, id };
  }

  private parseAttachment(conversationId: string, input: SendMessageInput) {
    const type = this.optionalAttachmentType(input.attachmentType);
    const storageKey = this.optionalText(input.attachmentStorageKey, "attachmentStorageKey", 1000);
    const fileName = this.optionalText(input.attachmentFileName, "attachmentFileName", 255);
    const mimeType = this.optionalText(input.attachmentMimeType, "attachmentMimeType", 160);
    const sizeBytes = this.optionalInteger(input.attachmentSizeBytes, "attachmentSizeBytes", 1, 25_000_000);

    const hasAny = Boolean(type || storageKey || fileName || mimeType || sizeBytes);
    if (!hasAny) return null;
    if (!type || !storageKey) {
      throw new BadRequestException("attachmentType and attachmentStorageKey are required for attachments");
    }
    if (!storageKey.startsWith(`message-attachments/${conversationId}/`)) {
      throw new BadRequestException("Attachment storage key does not belong to this conversation");
    }

    return {
      attachmentType: type,
      attachmentStorageKey: storageKey,
      attachmentFileName: fileName,
      attachmentMimeType: mimeType,
      attachmentSizeBytes: sizeBytes
    };
  }

  private contextUrl(type: MessageContextType, id: string) {
    if (type === MessageContextType.POST) return `/posts/${id}`;
    if (type === MessageContextType.SERVICE) return `/services/${id}`;
    return `/products/${id}`;
  }

  private optionalAttachmentType(value: unknown): MessageAttachmentType | null {
    if (value === undefined || value === null || value === "") return null;
    if (value === MessageAttachmentType.IMAGE || value === MessageAttachmentType.FILE) return value;
    throw new BadRequestException("attachmentType must be IMAGE or FILE");
  }

  private optionalContextType(value: unknown): MessageContextType | null {
    if (value === undefined || value === null || value === "") return null;
    if (
      value === MessageContextType.POST ||
      value === MessageContextType.SERVICE ||
      value === MessageContextType.PRODUCT
    ) return value;
    throw new BadRequestException("contextType must be POST, SERVICE, or PRODUCT");
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

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw new BadRequestException(`${field} must be a valid identifier`);
    }
    return value.trim();
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }

  private optionalText(value: unknown, field: string, maximum: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > maximum) {
      throw new BadRequestException(`${field} must be at most ${maximum} characters`);
    }
    return normalized;
  }

  private optionalInteger(value: unknown, field: string, minimum: number, maximum: number) {
    if (value === undefined || value === null || value === "") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new BadRequestException(`${field} must be an integer between ${minimum} and ${maximum}`);
    }
    return parsed;
  }
}
