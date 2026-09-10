import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface SetTypingInput {
  typing?: unknown;
}

const TYPING_TTL_MS = 7_000;

@Injectable()
export class MessagingPresenceService {
  private readonly typingExpiries = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  async setTyping(identity: AuthIdentity, conversationId: string, input: SetTypingInput) {
    const { userId, id } = await this.requireParticipant(identity, conversationId);
    if (typeof input.typing !== "boolean") {
      throw new BadRequestException("typing must be true or false");
    }

    const key = this.key(id, userId);
    if (input.typing) {
      const expiresAt = Date.now() + TYPING_TTL_MS;
      this.typingExpiries.set(key, expiresAt);
      return {
        conversationId: id,
        typing: true,
        expiresAt: new Date(expiresAt).toISOString()
      };
    }

    this.typingExpiries.delete(key);
    return { conversationId: id, typing: false, expiresAt: null };
  }

  async getTyping(identity: AuthIdentity, conversationId: string) {
    const { userId, id } = await this.requireParticipant(identity, conversationId);
    const now = Date.now();
    const prefix = `${id}:`;
    const typingUserIds: string[] = [];

    for (const [key, expiresAt] of this.typingExpiries.entries()) {
      if (!key.startsWith(prefix)) continue;
      if (expiresAt <= now) {
        this.typingExpiries.delete(key);
        continue;
      }

      const candidateUserId = key.slice(prefix.length);
      if (candidateUserId && candidateUserId !== userId) typingUserIds.push(candidateUserId);
    }

    return { conversationId: id, typingUserIds };
  }

  private async requireParticipant(identity: AuthIdentity, conversationId: string) {
    const id = this.requiredId(conversationId, "conversationId");
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");

    const participant = await this.prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: id,
          userId: user.id
        }
      },
      select: { conversationId: true }
    });
    if (!participant) throw new NotFoundException("Conversation not found");

    return { id, userId: user.id };
  }

  private key(conversationId: string, userId: string) {
    return `${conversationId}:${userId}`;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.length > 200) {
      throw new BadRequestException(`${field} must be a valid identifier`);
    }
    return value.trim();
  }
}
