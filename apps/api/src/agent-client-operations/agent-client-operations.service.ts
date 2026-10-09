import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  AgentPermissionScope,
  BookingStatus,
  Capability,
  CapabilityStatus,
  Prisma
} from "@prisma/client";

import { AgentRelationshipService } from "../agent-relationship/agent-relationship.service";
import { BookingScheduleService } from "../booking/booking-schedule.service";
import type {
  AcceptBookingInput,
  BookingPaginationInput,
  CancelBookingInput,
  DeclineBookingInput
} from "../booking/booking.service";
import { PrismaService } from "../database/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface AgentConversationPaginationInput {
  cursor?: unknown;
  limit?: unknown;
}

export interface AgentMessagePaginationInput {
  cursor?: unknown;
  limit?: unknown;
}

export interface AgentSendMessageInput {
  text?: unknown;
}

const publicUserSelect = {
  id: true,
  displayName: true,
  username: true,
  avatarUrl: true,
  location: true,
  emailVerified: true,
  phoneVerified: true
} satisfies Prisma.UserSelect;

const bookingSelect = {
  id: true,
  serviceId: true,
  clientUserId: true,
  hustlerUserId: true,
  conversationId: true,
  status: true,
  requestedStartAt: true,
  requestedEndAt: true,
  confirmedStartAt: true,
  confirmedEndAt: true,
  requirements: true,
  location: true,
  notes: true,
  serviceTitleSnapshot: true,
  agreedPriceMinor: true,
  currency: true,
  pricingTypeSnapshot: true,
  acceptedAt: true,
  declinedAt: true,
  paymentPendingAt: true,
  fundedAt: true,
  startedAt: true,
  completedAt: true,
  cancelledAt: true,
  cancelledByUserId: true,
  declineReason: true,
  cancellationReason: true,
  disputedAt: true,
  refundedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: publicUserSelect },
  hustler: { select: publicUserSelect },
  service: {
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      deliveryMode: true,
      priceMinor: true,
      currency: true,
      pricingType: true,
      location: true,
      professionalProfileId: true
    }
  }
} satisfies Prisma.BookingSelect;

const messagingParticipantSelect = {
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
  delegatedByAgentUserId: true,
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
  },
  delegatedByAgent: {
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
    include: { user: { select: messagingParticipantSelect } }
  },
  messages: {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
    select: messageSelect
  }
} satisfies Prisma.ConversationInclude;

type BookingRecord = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;
type MessageRecord = Prisma.MessageGetPayload<{ select: typeof messageSelect }>;
type ConversationRecord = Prisma.ConversationGetPayload<{ include: typeof conversationInclude }>;

type DelegationContext = {
  actorUserId: string;
  principalUserId: string;
  relationshipId: string;
  scope: AgentPermissionScope;
};

@Injectable()
export class AgentClientOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly relationships: AgentRelationshipService,
    private readonly bookingSchedule: BookingScheduleService,
    private readonly notifications: NotificationsService
  ) {}

  async listBookings(
    identity: AuthIdentity,
    principalUserId: string,
    input: BookingPaginationInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.BOOKING_MANAGE,
      true
    );

    const limit = this.parseLimit(input.limit, 20, 50);
    const cursor = this.decodeCursor(input.cursor, "booking cursor");

    const rows = await this.prisma.booking.findMany({
      where: {
        hustlerUserId: ctx.principalUserId,
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
      select: bookingSelect
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map((booking) => this.serializeBooking(booking)),
      nextCursor:
        hasMore && last
          ? this.encodeCursor(last.createdAt, last.id)
          : null,
      hasMore
    };
  }

  async getBooking(
    identity: AuthIdentity,
    principalUserId: string,
    bookingId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.BOOKING_MANAGE,
      true
    );
    return this.serializeBooking(
      await this.requirePrincipalBooking(
        ctx.principalUserId,
        this.requiredId(bookingId, "bookingId")
      )
    );
  }

  async acceptBooking(
    identity: AuthIdentity,
    principalUserId: string,
    bookingId: string,
    input: AcceptBookingInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.BOOKING_MANAGE,
      true
    );
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requirePrincipalBooking(ctx.principalUserId, id);

    if (booking.status !== BookingStatus.REQUESTED) {
      throw new ConflictException(
        `Booking cannot be accepted from ${booking.status}`
      );
    }

    await this.bookingSchedule.validateAcceptForHustler(
      ctx.principalUserId,
      id,
      input
    );

    const confirmedStartAt =
      this.optionalDate(input.confirmedStartAt, "confirmedStartAt") ??
      booking.requestedStartAt;
    const confirmedEndAt =
      input.confirmedEndAt === undefined
        ? booking.requestedEndAt
        : this.optionalDate(input.confirmedEndAt, "confirmedEndAt");

    if (confirmedStartAt.getTime() <= Date.now()) {
      throw new BadRequestException("confirmedStartAt must be in the future");
    }
    this.validateSchedule(
      confirmedStartAt,
      confirmedEndAt,
      "confirmed"
    );

    const paid = booking.agreedPriceMinor > 0;
    const nextStatus = paid
      ? BookingStatus.PAYMENT_PENDING
      : BookingStatus.ACCEPTED;
    const now = new Date();

    return this.transitionBookingWithAudit(
      ctx,
      booking,
      BookingStatus.REQUESTED,
      {
        status: nextStatus,
        confirmedStartAt,
        confirmedEndAt,
        acceptedAt: now,
        ...(paid ? { paymentPendingAt: now } : {})
      },
      "agent.booking.accepted",
      "booking.accepted",
      {
        status: nextStatus,
        ...(paid ? { paymentPending: true } : {})
      }
    );
  }

  async declineBooking(
    identity: AuthIdentity,
    principalUserId: string,
    bookingId: string,
    input: DeclineBookingInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.BOOKING_MANAGE,
      true
    );
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requirePrincipalBooking(ctx.principalUserId, id);

    if (booking.status !== BookingStatus.REQUESTED) {
      throw new ConflictException(
        `Booking cannot be declined from ${booking.status}`
      );
    }

    const reason = this.optionalText(input.reason, "reason", 1000);

    return this.transitionBookingWithAudit(
      ctx,
      booking,
      BookingStatus.REQUESTED,
      {
        status: BookingStatus.DECLINED,
        declinedAt: new Date(),
        declineReason: reason
      },
      "agent.booking.declined",
      "booking.declined",
      {
        status: BookingStatus.DECLINED,
        hasReason: Boolean(reason)
      }
    );
  }

  async cancelBooking(
    identity: AuthIdentity,
    principalUserId: string,
    bookingId: string,
    input: CancelBookingInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.BOOKING_MANAGE,
      true
    );
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requirePrincipalBooking(ctx.principalUserId, id);

    const allowed: BookingStatus[] = [
      BookingStatus.ACCEPTED,
      BookingStatus.PAYMENT_PENDING
    ];
    if (!allowed.includes(booking.status)) {
      if (booking.status === BookingStatus.REQUESTED) {
        throw new ConflictException(
          "Use decline for a Booking that has not yet been accepted"
        );
      }
      throw new ConflictException(
        `Agent cannot cancel a Booking from ${booking.status}. Funded/refund states remain owner/payment authority`
      );
    }

    const reason = this.optionalText(input.reason, "reason", 1000);

    return this.transitionBookingWithAudit(
      ctx,
      booking,
      booking.status,
      {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: ctx.principalUserId,
        cancellationReason: reason
      },
      "agent.booking.cancelled",
      "booking.cancelled",
      {
        fromStatus: booking.status,
        status: BookingStatus.CANCELLED,
        hasReason: Boolean(reason)
      }
    );
  }

  async startBooking(
    identity: AuthIdentity,
    principalUserId: string,
    bookingId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.BOOKING_MANAGE,
      true
    );
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requirePrincipalBooking(ctx.principalUserId, id);

    const requiredStatus =
      booking.agreedPriceMinor > 0
        ? BookingStatus.FUNDED
        : BookingStatus.ACCEPTED;

    if (booking.status !== requiredStatus) {
      if (
        booking.agreedPriceMinor > 0 &&
        booking.status === BookingStatus.PAYMENT_PENDING
      ) {
        throw new ConflictException(
          "Payment is still pending. An Agent cannot start paid work before authoritative funding confirmation"
        );
      }
      throw new ConflictException(
        `Booking cannot start from ${booking.status}`
      );
    }

    return this.transitionBookingWithAudit(
      ctx,
      booking,
      requiredStatus,
      {
        status: BookingStatus.IN_PROGRESS,
        startedAt: new Date()
      },
      "agent.booking.started",
      "booking.started",
      {
        fromStatus: requiredStatus,
        status: BookingStatus.IN_PROGRESS
      }
    );
  }

  async listConversations(
    identity: AuthIdentity,
    principalUserId: string,
    input: AgentConversationPaginationInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CLIENT_MESSAGE_MANAGE,
      false
    );
    const limit = this.parseLimit(input.limit, 20, 50);
    const cursor = this.decodeCursor(input.cursor, "conversation cursor");

    const rows = await this.prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId: ctx.principalUserId }
        },
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
      include: conversationInclude
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page.at(-1);

    return {
      items: page.map((conversation) =>
        this.serializeConversation(conversation, ctx.principalUserId)
      ),
      nextCursor:
        hasMore && last
          ? this.encodeCursor(last.lastActivityAt, last.id)
          : null,
      hasMore
    };
  }

  async getConversation(
    identity: AuthIdentity,
    principalUserId: string,
    conversationId: string
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CLIENT_MESSAGE_MANAGE,
      false
    );
    const conversation = await this.requirePrincipalConversation(
      ctx.principalUserId,
      this.requiredId(conversationId, "conversationId")
    );
    return this.serializeConversation(
      conversation,
      ctx.principalUserId
    );
  }

  async listMessages(
    identity: AuthIdentity,
    principalUserId: string,
    conversationId: string,
    input: AgentMessagePaginationInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CLIENT_MESSAGE_MANAGE,
      false
    );
    const id = this.requiredId(conversationId, "conversationId");
    await this.requirePrincipalConversation(ctx.principalUserId, id);

    const limit = this.parseLimit(input.limit, 50, 100);
    const cursor = this.decodeCursor(input.cursor, "message cursor");

    const rows = await this.prisma.message.findMany({
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

    const hasMore = rows.length > limit;
    const descending = hasMore ? rows.slice(0, limit) : rows;
    const oldest = descending.at(-1);

    return {
      items: descending
        .reverse()
        .map((message) => this.serializeMessage(message)),
      nextCursor:
        hasMore && oldest
          ? this.encodeCursor(oldest.createdAt, oldest.id)
          : null,
      hasMore
    };
  }

  async sendMessage(
    identity: AuthIdentity,
    principalUserId: string,
    conversationId: string,
    input: AgentSendMessageInput
  ) {
    const ctx = await this.requireDelegation(
      identity,
      principalUserId,
      AgentPermissionScope.CLIENT_MESSAGE_MANAGE,
      false
    );
    const id = this.requiredId(conversationId, "conversationId");
    const conversation = await this.requirePrincipalConversation(
      ctx.principalUserId,
      id
    );
    const other = conversation.participants.find(
      (item) => item.userId !== ctx.principalUserId
    );
    if (!other) {
      throw new BadRequestException(
        "Direct conversation has no counterparty"
      );
    }

    await this.assertUsersCanContact(
      ctx.principalUserId,
      other.userId
    );

    const text = this.requiredText(input.text, "text", 4000);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: id,
          senderId: ctx.principalUserId,
          delegatedByAgentUserId: ctx.actorUserId,
          text
        },
        select: messageSelect
      });

      await tx.conversation.update({
        where: { id },
        data: { lastActivityAt: now }
      });

      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: ctx.relationshipId,
          actorUserId: ctx.actorUserId,
          ownerUserId: ctx.principalUserId,
          permissionScope: AgentPermissionScope.CLIENT_MESSAGE_MANAGE,
          action: "agent.message.sent",
          entityType: "Message",
          entityId: message.id,
          metadata: {
            conversationId: id,
            counterpartyUserId: other.userId
          }
        }
      });

      await tx.systemEvent.create({
        data: {
          name: "messaging.message_sent",
          source: "api",
          payload: {
            conversationId: id,
            messageId: message.id,
            senderUserId: ctx.principalUserId,
            delegatedByAgentUserId: ctx.actorUserId,
            relationshipId: ctx.relationshipId,
            permissionScope:
              AgentPermissionScope.CLIENT_MESSAGE_MANAGE,
            hasText: true,
            attachmentType: null,
            contextType: null,
            contextId: null
          }
        }
      });

      await this.notifications.recordDirectMessage(tx, message);
      return message;
    });

    return this.serializeMessage(result);
  }

  private async requireDelegation(
    identity: AuthIdentity,
    principalUserId: string,
    scope: AgentPermissionScope,
    requiresHustler: boolean
  ): Promise<DelegationContext> {
    const actor = await this.requireAgent(identity);
    const principalId = this.requiredId(
      principalUserId,
      "principalUserId"
    );

    const relationship =
      await this.relationships.assertAgentPermission(
        actor.id,
        principalId,
        scope
      );

    if (requiresHustler) {
      const capability =
        await this.prisma.userCapability.findUnique({
          where: {
            userId_capability: {
              userId: principalId,
              capability: Capability.HUSTLER
            }
          },
          select: { status: true }
        });
      if (
        capability?.status !== CapabilityStatus.ACTIVE
      ) {
        throw new ForbiddenException(
          "The represented account needs ACTIVE HUSTLER capability for booking management"
        );
      }
    }

    return {
      actorUserId: actor.id,
      principalUserId: principalId,
      relationshipId: relationship.id,
      scope
    };
  }

  private async requireAgent(identity: AuthIdentity) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: {
        id: true,
        capabilities: {
          where: { capability: Capability.AGENT },
          select: { status: true }
        }
      }
    });
    if (!user) {
      throw new NotFoundException(
        "Hustle account is not synchronized"
      );
    }
    if (
      user.capabilities[0]?.status !==
      CapabilityStatus.ACTIVE
    ) {
      throw new ForbiddenException(
        "ACTIVE AGENT capability required"
      );
    }
    return user;
  }

  private async requirePrincipalBooking(
    principalUserId: string,
    bookingId: string
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        hustlerUserId: principalUserId
      },
      select: bookingSelect
    });
    if (!booking) {
      throw new NotFoundException(
        "Booking not found for this represented Hustler"
      );
    }
    return booking;
  }

  private async requirePrincipalConversation(
    principalUserId: string,
    conversationId: string
  ) {
    const conversation =
      await this.prisma.conversation.findFirst({
        where: {
          id: conversationId,
          type: "DIRECT",
          participants: {
            some: { userId: principalUserId }
          }
        },
        include: conversationInclude
      });
    if (!conversation) {
      throw new NotFoundException(
        "Conversation not found for this represented account"
      );
    }
    return conversation;
  }

  private async transitionBookingWithAudit(
    ctx: DelegationContext,
    booking: BookingRecord,
    expectedStatus: BookingStatus,
    data: Prisma.BookingUncheckedUpdateManyInput,
    auditAction: string,
    systemEventName: string,
    metadata: Prisma.InputJsonObject
  ) {
    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.booking.updateMany({
        where: {
          id: booking.id,
          hustlerUserId: ctx.principalUserId,
          status: expectedStatus
        },
        data
      });

      if (changed.count !== 1) {
        throw new ConflictException(
          "Booking changed before this delegated action could be completed. Refresh and try again"
        );
      }

      const updated = await tx.booking.findUniqueOrThrow({
        where: { id: booking.id },
        select: bookingSelect
      });

      await tx.agentDelegationAudit.create({
        data: {
          relationshipId: ctx.relationshipId,
          actorUserId: ctx.actorUserId,
          ownerUserId: ctx.principalUserId,
          permissionScope: AgentPermissionScope.BOOKING_MANAGE,
          action: auditAction,
          entityType: "Booking",
          entityId: booking.id,
          metadata
        }
      });

      await tx.systemEvent.create({
        data: {
          name: systemEventName,
          source: "api",
          payload: {
            bookingId: booking.id,
            serviceId: booking.serviceId,
            actorUserId: ctx.actorUserId,
            actorRole: "AGENT",
            delegatedForUserId: ctx.principalUserId,
            relationshipId: ctx.relationshipId,
            permissionScope: AgentPermissionScope.BOOKING_MANAGE,
            ...metadata
          }
        }
      });

      if (
        systemEventName === "booking.accepted" &&
        updated.status === BookingStatus.PAYMENT_PENDING
      ) {
        await tx.systemEvent.create({
          data: {
            name: "booking.payment_pending",
            source: "api",
            payload: {
              bookingId: booking.id,
              serviceId: booking.serviceId,
              actorUserId: ctx.actorUserId,
              actorRole: "AGENT",
              delegatedForUserId: ctx.principalUserId,
              relationshipId: ctx.relationshipId,
              permissionScope:
                AgentPermissionScope.BOOKING_MANAGE,
              status: BookingStatus.PAYMENT_PENDING
            }
          }
        });
      }

      return this.serializeBooking(updated);
    });
  }

  private serializeBooking(booking: BookingRecord) {
    const paid = booking.agreedPriceMinor > 0;

    return {
      ...booking,
      client: this.serializeBookingUser(booking.client),
      hustler: this.serializeBookingUser(booking.hustler),
      viewerRole: "HUSTLER" as const,
      representedByAgent: true,
      paymentBoundary: {
        required: paid,
        funded:
          booking.status === BookingStatus.FUNDED ||
          booking.status === BookingStatus.IN_PROGRESS ||
          booking.status === BookingStatus.COMPLETED ||
          booking.fundedAt !== null,
        phase: paid ? "PHASE_13" : null,
        message:
          paid &&
          booking.status === BookingStatus.PAYMENT_PENDING
            ? "Payment is required before work begins. The Agent cannot fund, refund, release or redirect money."
            : null
      },
      agentAllowedActions:
        this.agentAllowedBookingActions(booking),
      nextAction: this.agentNextBookingAction(booking)
    };
  }

  private agentAllowedBookingActions(
    booking: BookingRecord
  ) {
    if (booking.status === BookingStatus.REQUESTED) {
      return ["ACCEPT", "DECLINE"] as const;
    }
    if (
      booking.status === BookingStatus.ACCEPTED ||
      booking.status === BookingStatus.PAYMENT_PENDING
    ) {
      return [
        ...(booking.status === BookingStatus.ACCEPTED &&
        booking.agreedPriceMinor === 0
          ? ["START" as const]
          : []),
        "CANCEL" as const
      ];
    }
    if (booking.status === BookingStatus.FUNDED) {
      return ["START"] as const;
    }
    return [] as const;
  }

  private agentNextBookingAction(booking: BookingRecord) {
    switch (booking.status) {
      case BookingStatus.REQUESTED:
        return "Accept or decline this client request";
      case BookingStatus.ACCEPTED:
        return booking.agreedPriceMinor > 0
          ? "Waiting for payment authority"
          : "Start work or cancel before work begins";
      case BookingStatus.PAYMENT_PENDING:
        return "Waiting for authoritative payment confirmation";
      case BookingStatus.FUNDED:
        return "Funding confirmed. Agent may start work";
      case BookingStatus.IN_PROGRESS:
        return "Work is active. Only the Hustler can mark it complete";
      case BookingStatus.COMPLETED:
        return "Completed — no Agent financial/reputation action";
      default:
        return null;
    }
  }

  private serializeBookingUser(
    user: Prisma.UserGetPayload<{
      select: typeof publicUserSelect;
    }>
  ) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      location: user.location,
      verified:
        user.emailVerified || user.phoneVerified
    };
  }

  private serializeConversation(
    conversation: ConversationRecord,
    principalUserId: string
  ) {
    const principal = conversation.participants.find(
      (item) => item.userId === principalUserId
    );
    const other = conversation.participants.find(
      (item) => item.userId !== principalUserId
    );

    return {
      id: conversation.id,
      type: conversation.type,
      lastActivityAt: conversation.lastActivityAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      representedUserId: principalUserId,
      principalLastReadAt: principal?.lastReadAt ?? null,
      otherParticipant: other
        ? this.serializeMessagingParticipant(other.user)
        : null,
      lastMessage: conversation.messages[0]
        ? this.serializeMessage(conversation.messages[0])
        : null
    };
  }

  private serializeMessagingParticipant(
    user: Prisma.UserGetPayload<{
      select: typeof messagingParticipantSelect;
    }>
  ) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      location: user.location,
      verified:
        user.emailVerified || user.phoneVerified,
      professionalProfile: user.professionalProfile
        ? {
            headline:
              user.professionalProfile.headline,
            primarySkill:
              user.professionalProfile.primarySkill,
            category:
              user.professionalProfile.category,
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
      attachment:
        message.attachmentType &&
        message.attachmentStorageKey
          ? {
              type: message.attachmentType,
              storageKey:
                message.attachmentStorageKey,
              fileName: message.attachmentFileName,
              mimeType: message.attachmentMimeType,
              sizeBytes: message.attachmentSizeBytes
            }
          : null,
      context:
        message.contextType && message.contextId
          ? {
              type: message.contextType,
              id: message.contextId,
              url: this.contextUrl(
                message.contextType,
                message.contextId
              )
            }
          : null,
      sender: message.sender,
      delegatedByAgent: message.delegatedByAgent,
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }

  private async assertUsersCanContact(
    firstUserId: string,
    secondUserId: string
  ) {
    const block = await this.prisma.userBlock.findFirst({
      where: {
        OR: [
          {
            blockerUserId: firstUserId,
            blockedUserId: secondUserId
          },
          {
            blockerUserId: secondUserId,
            blockedUserId: firstUserId
          }
        ]
      },
      select: { blockerUserId: true }
    });
    if (block) {
      throw new ForbiddenException(
        "Messaging is unavailable because one participant has blocked the other"
      );
    }
  }

  private contextUrl(type: string, id: string) {
    if (type === "POST") return `/posts/${id}`;
    if (type === "SERVICE") return `/services/${id}`;
    return `/products/${id}`;
  }

  private validateSchedule(
    start: Date,
    end: Date | null,
    label: string
  ) {
    if (end && end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        `${label}EndAt must be after ${label}StartAt`
      );
    }
  }

  private optionalDate(value: unknown, field: string) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(
        `${field} must be an ISO date-time string`
      );
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        `${field} must be a valid ISO date-time string`
      );
    }
    return date;
  }

  private requiredText(
    value: unknown,
    field: string,
    max: number
  ) {
    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      throw new BadRequestException(
        `${field} is required`
      );
    }
    const normalized = value.trim();
    if (normalized.length > max) {
      throw new BadRequestException(
        `${field} must be at most ${max} characters`
      );
    }
    return normalized;
  }

  private optionalText(
    value: unknown,
    field: string,
    max: number
  ) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(
        `${field} must be text`
      );
    }
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) {
      throw new BadRequestException(
        `${field} must be at most ${max} characters`
      );
    }
    return normalized;
  }

  private parseLimit(
    value: unknown,
    fallback: number,
    max: number
  ) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return fallback;
    }
    const parsed = Number(value);
    if (
      !Number.isInteger(parsed) ||
      parsed < 1 ||
      parsed > max
    ) {
      throw new BadRequestException(
        `limit must be an integer between 1 and ${max}`
      );
    }
    return parsed;
  }

  private encodeCursor(timestamp: Date, id: string) {
    return Buffer.from(
      JSON.stringify({
        timestamp: timestamp.toISOString(),
        id
      })
    ).toString("base64url");
  }

  private decodeCursor(value: unknown, field: string) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return null;
    }
    if (typeof value !== "string") {
      throw new BadRequestException(
        `${field} is invalid`
      );
    }
    try {
      const decoded = JSON.parse(
        Buffer.from(value, "base64url").toString("utf8")
      ) as {
        timestamp?: unknown;
        id?: unknown;
      };
      if (
        typeof decoded.timestamp !== "string" ||
        typeof decoded.id !== "string"
      ) {
        throw new Error("invalid cursor");
      }
      const timestamp = new Date(decoded.timestamp);
      if (
        Number.isNaN(timestamp.getTime()) ||
        !decoded.id.trim()
      ) {
        throw new Error("invalid cursor");
      }
      return { timestamp, id: decoded.id };
    } catch {
      throw new BadRequestException(
        `${field} is invalid`
      );
    }
  }

  private requiredId(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.trim().length > 200
    ) {
      throw new BadRequestException(
        `${field} is required`
      );
    }
    return value.trim();
  }
}
