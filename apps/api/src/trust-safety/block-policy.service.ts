import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

@Injectable()
export class BlockPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async status(identity: AuthIdentity, targetUserIdInput: string) {
    const viewer = await this.requireUser(identity);
    const targetUserId = this.requiredId(targetUserIdInput, "targetUserId");
    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true
      }
    });
    if (!target) throw new NotFoundException("User not found");

    if (viewer.id === targetUserId) {
      return {
        target,
        isSelf: true,
        viewerBlockedTarget: false,
        targetBlockedViewer: false,
        messagingAllowed: false
      };
    }

    const blocks = await this.prisma.userBlock.findMany({
      where: {
        OR: [
          { blockerUserId: viewer.id, blockedUserId: targetUserId },
          { blockerUserId: targetUserId, blockedUserId: viewer.id }
        ]
      },
      select: { blockerUserId: true, blockedUserId: true }
    });

    const viewerBlockedTarget = blocks.some(
      (item) => item.blockerUserId === viewer.id && item.blockedUserId === targetUserId
    );
    const targetBlockedViewer = blocks.some(
      (item) => item.blockerUserId === targetUserId && item.blockedUserId === viewer.id
    );

    return {
      target,
      isSelf: false,
      viewerBlockedTarget,
      targetBlockedViewer,
      messagingAllowed: !viewerBlockedTarget && !targetBlockedViewer
    };
  }

  async assertDirectContact(identity: AuthIdentity, targetUserIdInput: unknown) {
    const viewer = await this.requireUser(identity);
    const targetUserId = this.requiredId(targetUserIdInput, "recipientUserId");
    if (viewer.id === targetUserId) {
      throw new BadRequestException("You cannot start a conversation with yourself");
    }

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true }
    });
    if (!target) throw new NotFoundException("Recipient not found");

    await this.assertUsersCanContact(viewer.id, target.id);
  }

  async assertConversationContact(identity: AuthIdentity, conversationIdInput: unknown) {
    const viewer = await this.requireUser(identity);
    const conversationId = this.requiredId(conversationIdInput, "conversationId");
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        participants: { some: { userId: viewer.id } }
      },
      select: {
        participants: { select: { userId: true } }
      }
    });
    if (!conversation) throw new NotFoundException("Conversation not found");

    const other = conversation.participants.find((item) => item.userId !== viewer.id);
    if (!other) throw new BadRequestException("Direct conversation has no counterparty");
    await this.assertUsersCanContact(viewer.id, other.userId);
  }

  private async assertUsersCanContact(firstUserId: string, secondUserId: string) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerUserId: firstUserId, blockedUserId: secondUserId },
          { blockerUserId: secondUserId, blockedUserId: firstUserId }
        ]
      },
      select: { blockerUserId: true }
    });

    if (block) {
      throw new ForbiddenException(
        "Messaging is unavailable between these users because one has blocked the other"
      );
    }
  }

  private async requireUser(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new NotFoundException("Hustle account is not synchronized");
    return user;
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }
}
