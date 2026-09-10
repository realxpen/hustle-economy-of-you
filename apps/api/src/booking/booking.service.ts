import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  BookingStatus,
  Capability,
  CapabilityStatus,
  Prisma,
  ProfessionalProfileStatus,
  ServiceStatus
} from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

export interface CreateBookingInput {
  serviceId?: unknown;
  requestedStartAt?: unknown;
  requestedEndAt?: unknown;
  requirements?: unknown;
  location?: unknown;
  notes?: unknown;
  conversationId?: unknown;
}

export interface BookingPaginationInput {
  cursor?: unknown;
  limit?: unknown;
}

export interface AcceptBookingInput {
  confirmedStartAt?: unknown;
  confirmedEndAt?: unknown;
}

export interface DeclineBookingInput {
  reason?: unknown;
}

export interface CancelBookingInput {
  reason?: unknown;
}

export interface AuthoritativeFundingInput {
  bookingId: string;
  fundingReference: string;
  source?: string;
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

type BookingRecord = Prisma.BookingGetPayload<{ select: typeof bookingSelect }>;

@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async create(identity: AuthIdentity, input: CreateBookingInput) {
    const client = await this.requireUser(identity);
    const serviceId = this.requiredId(input.serviceId, "serviceId");
    const requestedStartAt = this.requiredDate(input.requestedStartAt, "requestedStartAt");
    const requestedEndAt = this.optionalDate(input.requestedEndAt, "requestedEndAt");
    const requirements = this.requiredText(input.requirements, "requirements", 4000);
    const location = this.optionalText(input.location, "location", 300);
    const notes = this.optionalText(input.notes, "notes", 2000);
    const conversationId = this.optionalId(input.conversationId, "conversationId");

    if (requestedStartAt.getTime() <= Date.now()) {
      throw new BadRequestException("requestedStartAt must be in the future");
    }
    this.validateSchedule(requestedStartAt, requestedEndAt, "requested");

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        status: ServiceStatus.PUBLISHED,
        professionalProfile: {
          is: {
            status: ProfessionalProfileStatus.PUBLISHED,
            user: {
              capabilities: {
                some: {
                  capability: Capability.HUSTLER,
                  status: CapabilityStatus.ACTIVE
                }
              }
            }
          }
        }
      },
      select: {
        id: true,
        title: true,
        priceMinor: true,
        currency: true,
        pricingType: true,
        professionalProfile: {
          select: { userId: true }
        }
      }
    });

    if (!service) throw new NotFoundException("Service is not currently bookable");
    if (!service.title?.trim()) throw new BadRequestException("Service is missing a booking title");
    if (service.priceMinor === null) {
      throw new BadRequestException("Service must have a concrete price before it can be booked");
    }

    const hustlerUserId = service.professionalProfile.userId;
    if (client.id === hustlerUserId) {
      throw new BadRequestException("You cannot book your own Service");
    }

    if (conversationId) {
      await this.requireDirectConversationForPair(conversationId, client.id, hustlerUserId);
    }

    const booking = await this.prisma.booking.create({
      data: {
        serviceId: service.id,
        clientUserId: client.id,
        hustlerUserId,
        conversationId,
        requestedStartAt,
        requestedEndAt,
        requirements,
        location,
        notes,
        serviceTitleSnapshot: service.title.trim(),
        agreedPriceMinor: service.priceMinor,
        currency: service.currency,
        pricingTypeSnapshot: service.pricingType
      },
      select: bookingSelect
    });

    await this.recordEvent("booking.requested", {
      bookingId: booking.id,
      serviceId: booking.serviceId,
      clientUserId: booking.clientUserId,
      hustlerUserId: booking.hustlerUserId,
      status: booking.status,
      hasConversation: Boolean(booking.conversationId)
    });

    return this.serializeBooking(booking, client.id);
  }

  async listClient(identity: AuthIdentity, input: BookingPaginationInput) {
    const viewer = await this.requireUser(identity);
    return this.listForUser(viewer.id, "client", input);
  }

  async listHustler(identity: AuthIdentity, input: BookingPaginationInput) {
    const viewer = await this.requireUser(identity);
    await this.requireActiveHustler(viewer.id);
    return this.listForUser(viewer.id, "hustler", input);
  }

  async get(identity: AuthIdentity, bookingId: string) {
    const viewer = await this.requireUser(identity);
    const booking = await this.requireBookingParticipant(
      this.requiredId(bookingId, "bookingId"),
      viewer.id
    );
    return this.serializeBooking(booking, viewer.id);
  }

  async accept(identity: AuthIdentity, bookingId: string, input: AcceptBookingInput) {
    const viewer = await this.requireUser(identity);
    await this.requireActiveHustler(viewer.id);
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requireBookingParticipant(id, viewer.id);

    if (booking.hustlerUserId !== viewer.id) {
      throw new ForbiddenException("Only the booked Hustler can accept this Booking");
    }
    if (booking.status !== BookingStatus.REQUESTED) {
      throw new ConflictException(`Booking cannot be accepted from ${booking.status}`);
    }

    const confirmedStartAt = this.optionalDate(input.confirmedStartAt, "confirmedStartAt")
      ?? booking.requestedStartAt;
    const confirmedEndAt = input.confirmedEndAt === undefined
      ? booking.requestedEndAt
      : this.optionalDate(input.confirmedEndAt, "confirmedEndAt");

    if (confirmedStartAt.getTime() <= Date.now()) {
      throw new BadRequestException("confirmedStartAt must be in the future");
    }
    this.validateSchedule(confirmedStartAt, confirmedEndAt, "confirmed");

    const paid = booking.agreedPriceMinor > 0;
    const nextStatus = paid ? BookingStatus.PAYMENT_PENDING : BookingStatus.ACCEPTED;
    const now = new Date();

    const updated = await this.transition(
      id,
      BookingStatus.REQUESTED,
      {
        status: nextStatus,
        confirmedStartAt,
        confirmedEndAt,
        acceptedAt: now,
        ...(paid ? { paymentPendingAt: now } : {})
      },
      viewer.id
    );

    await this.recordEvent("booking.accepted", {
      bookingId: id,
      serviceId: updated.serviceId,
      actorUserId: viewer.id,
      actorRole: "HUSTLER",
      status: nextStatus
    });

    if (paid) {
      await this.recordEvent("booking.payment_pending", {
        bookingId: id,
        serviceId: updated.serviceId,
        actorUserId: viewer.id,
        actorRole: "HUSTLER",
        status: BookingStatus.PAYMENT_PENDING
      });
    }

    return this.serializeBooking(updated, viewer.id);
  }

  async decline(identity: AuthIdentity, bookingId: string, input: DeclineBookingInput) {
    const viewer = await this.requireUser(identity);
    await this.requireActiveHustler(viewer.id);
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requireBookingParticipant(id, viewer.id);

    if (booking.hustlerUserId !== viewer.id) {
      throw new ForbiddenException("Only the booked Hustler can decline this Booking");
    }
    if (booking.status !== BookingStatus.REQUESTED) {
      throw new ConflictException(`Booking cannot be declined from ${booking.status}`);
    }

    const reason = this.optionalText(input.reason, "reason", 1000);
    const updated = await this.transition(
      id,
      BookingStatus.REQUESTED,
      { status: BookingStatus.DECLINED, declinedAt: new Date(), declineReason: reason },
      viewer.id
    );

    await this.recordEvent("booking.declined", {
      bookingId: id,
      serviceId: updated.serviceId,
      actorUserId: viewer.id,
      actorRole: "HUSTLER",
      status: BookingStatus.DECLINED,
      hasReason: Boolean(reason)
    });

    return this.serializeBooking(updated, viewer.id);
  }

  async cancel(identity: AuthIdentity, bookingId: string, input: CancelBookingInput) {
    const viewer = await this.requireUser(identity);
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requireBookingParticipant(id, viewer.id);
    const actorRole = booking.clientUserId === viewer.id ? "CLIENT" : "HUSTLER";

    if (actorRole === "HUSTLER") {
      await this.requireActiveHustler(viewer.id);
    }

    const allowed = actorRole === "CLIENT"
      ? [BookingStatus.REQUESTED, BookingStatus.ACCEPTED, BookingStatus.PAYMENT_PENDING]
      : [BookingStatus.ACCEPTED, BookingStatus.PAYMENT_PENDING];

    if (!allowed.includes(booking.status)) {
      throw new ConflictException(
        actorRole === "HUSTLER" && booking.status === BookingStatus.REQUESTED
          ? "Use decline for a Booking that has not yet been accepted"
          : `Booking cannot be cancelled from ${booking.status}`
      );
    }

    const reason = this.optionalText(input.reason, "reason", 1000);
    const updated = await this.transition(
      id,
      booking.status,
      {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledByUserId: viewer.id,
        cancellationReason: reason
      },
      viewer.id
    );

    await this.recordEvent("booking.cancelled", {
      bookingId: id,
      serviceId: updated.serviceId,
      actorUserId: viewer.id,
      actorRole,
      fromStatus: booking.status,
      status: BookingStatus.CANCELLED,
      hasReason: Boolean(reason)
    });

    return this.serializeBooking(updated, viewer.id);
  }

  async start(identity: AuthIdentity, bookingId: string) {
    const viewer = await this.requireUser(identity);
    await this.requireActiveHustler(viewer.id);
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requireBookingParticipant(id, viewer.id);

    if (booking.hustlerUserId !== viewer.id) {
      throw new ForbiddenException("Only the booked Hustler can start this Booking");
    }

    const requiredStatus = booking.agreedPriceMinor > 0
      ? BookingStatus.FUNDED
      : BookingStatus.ACCEPTED;

    if (booking.status !== requiredStatus) {
      if (booking.agreedPriceMinor > 0 && booking.status === BookingStatus.PAYMENT_PENDING) {
        throw new ConflictException(
          "Payment is still pending. Paid Bookings can only start after authoritative Phase 13 funding confirmation"
        );
      }
      throw new ConflictException(`Booking cannot start from ${booking.status}`);
    }

    const updated = await this.transition(
      id,
      requiredStatus,
      { status: BookingStatus.IN_PROGRESS, startedAt: new Date() },
      viewer.id
    );

    await this.recordEvent("booking.started", {
      bookingId: id,
      serviceId: updated.serviceId,
      actorUserId: viewer.id,
      actorRole: "HUSTLER",
      fromStatus: requiredStatus,
      status: BookingStatus.IN_PROGRESS
    });

    return this.serializeBooking(updated, viewer.id);
  }

  async complete(identity: AuthIdentity, bookingId: string) {
    const viewer = await this.requireUser(identity);
    await this.requireActiveHustler(viewer.id);
    const id = this.requiredId(bookingId, "bookingId");
    const booking = await this.requireBookingParticipant(id, viewer.id);

    if (booking.hustlerUserId !== viewer.id) {
      throw new ForbiddenException("Only the booked Hustler can complete this Booking");
    }
    if (booking.status !== BookingStatus.IN_PROGRESS) {
      throw new ConflictException(`Booking cannot be completed from ${booking.status}`);
    }

    const updated = await this.transition(
      id,
      BookingStatus.IN_PROGRESS,
      { status: BookingStatus.COMPLETED, completedAt: new Date() },
      viewer.id
    );

    await this.recordEvent("booking.completed", {
      bookingId: id,
      serviceId: updated.serviceId,
      actorUserId: viewer.id,
      actorRole: "HUSTLER",
      status: BookingStatus.COMPLETED
    });

    return this.serializeBooking(updated, viewer.id);
  }

  /**
   * Phase 13 integration boundary. This method is deliberately not exposed by
   * BookingController. A future payment/escrow module may call it only after an
   * authoritative, idempotently-verified funding event.
   */
  async markFundedFromAuthoritativePayment(input: AuthoritativeFundingInput) {
    const bookingId = this.requiredId(input.bookingId, "bookingId");
    const fundingReference = this.requiredText(input.fundingReference, "fundingReference", 300);
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
    if (!booking) throw new NotFoundException("Booking not found");

    if (booking.status === BookingStatus.FUNDED) {
      return this.serializeBooking(booking, booking.clientUserId);
    }
    if (booking.status !== BookingStatus.PAYMENT_PENDING) {
      throw new ConflictException(`Booking cannot be funded from ${booking.status}`);
    }
    if (booking.agreedPriceMinor <= 0) {
      throw new ConflictException("This Booking does not require funding");
    }

    const updated = await this.transition(
      bookingId,
      BookingStatus.PAYMENT_PENDING,
      { status: BookingStatus.FUNDED, fundedAt: new Date() },
      booking.clientUserId
    );

    await this.recordEvent("booking.funded", {
      bookingId,
      serviceId: updated.serviceId,
      actorRole: "PAYMENT_SYSTEM",
      fundingReference,
      source: input.source ?? "phase13",
      status: BookingStatus.FUNDED
    });

    return this.serializeBooking(updated, booking.clientUserId);
  }

  private async listForUser(
    userId: string,
    side: "client" | "hustler",
    input: BookingPaginationInput
  ) {
    const limit = this.parseLimit(input.limit, 20, 50);
    const cursor = this.decodeCursor(input.cursor);
    const sideWhere = side === "client" ? { clientUserId: userId } : { hustlerUserId: userId };

    const rows = await this.prisma.booking.findMany({
      where: {
        ...sideWhere,
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
      items: page.map((booking) => this.serializeBooking(booking, userId)),
      nextCursor: hasMore && last ? this.encodeCursor(last.createdAt, last.id) : null,
      hasMore
    };
  }

  private async transition(
    bookingId: string,
    expectedStatus: BookingStatus,
    data: Prisma.BookingUpdateManyMutationInput,
    viewerUserId: string
  ) {
    const result = await this.prisma.booking.updateMany({
      where: { id: bookingId, status: expectedStatus },
      data
    });
    if (result.count !== 1) {
      throw new ConflictException("Booking changed before this action could be completed. Refresh and try again");
    }

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: bookingSelect });
    if (!booking) throw new NotFoundException("Booking not found");
    if (booking.clientUserId !== viewerUserId && booking.hustlerUserId !== viewerUserId) {
      throw new NotFoundException("Booking not found");
    }
    return booking;
  }

  private async requireBookingParticipant(bookingId: string, userId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: {
        id: bookingId,
        OR: [{ clientUserId: userId }, { hustlerUserId: userId }]
      },
      select: bookingSelect
    });
    if (!booking) throw new NotFoundException("Booking not found");
    return booking;
  }

  private async requireDirectConversationForPair(
    conversationId: string,
    clientUserId: string,
    hustlerUserId: string
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        type: true,
        participants: { select: { userId: true } }
      }
    });
    if (!conversation || conversation.type !== "DIRECT") {
      throw new BadRequestException("conversationId must reference the direct conversation for this Booking pair");
    }
    const users = conversation.participants.map((item) => item.userId).sort();
    const expected = [clientUserId, hustlerUserId].sort();
    if (users.length !== 2 || users[0] !== expected[0] || users[1] !== expected[1]) {
      throw new BadRequestException("conversationId does not belong to the Booking participants");
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

  private async requireActiveHustler(userId: string) {
    const capability = await this.prisma.userCapability.findUnique({
      where: {
        userId_capability: {
          userId,
          capability: Capability.HUSTLER
        }
      },
      select: { status: true }
    });
    if (!capability || capability.status !== CapabilityStatus.ACTIVE) {
      throw new ForbiddenException("An ACTIVE HUSTLER capability is required for this action");
    }
  }

  private serializeBooking(booking: BookingRecord, viewerUserId: string) {
    const viewerRole = booking.clientUserId === viewerUserId ? "CLIENT" : "HUSTLER";
    const paid = booking.agreedPriceMinor > 0;

    return {
      ...booking,
      client: this.serializeUser(booking.client),
      hustler: this.serializeUser(booking.hustler),
      viewerRole,
      paymentBoundary: {
        required: paid,
        funded: booking.status === BookingStatus.FUNDED
          || booking.status === BookingStatus.IN_PROGRESS
          || booking.status === BookingStatus.COMPLETED
          || booking.fundedAt !== null,
        phase: paid ? "PHASE_13" : null,
        message: paid && booking.status === BookingStatus.PAYMENT_PENDING
          ? "Payment is required before work begins. Phase 13 will provide authoritative funding confirmation."
          : null
      },
      nextAction: this.nextAction(booking, viewerRole)
    };
  }

  private serializeUser(user: Prisma.UserGetPayload<{ select: typeof publicUserSelect }>) {
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      avatarUrl: user.avatarUrl,
      location: user.location,
      verified: user.emailVerified || user.phoneVerified
    };
  }

  private nextAction(booking: BookingRecord, viewerRole: "CLIENT" | "HUSTLER") {
    switch (booking.status) {
      case BookingStatus.REQUESTED:
        return viewerRole === "HUSTLER" ? "Accept or decline this request" : "Waiting for Hustler response";
      case BookingStatus.ACCEPTED:
        return booking.agreedPriceMinor > 0
          ? "Payment setup is required"
          : viewerRole === "HUSTLER"
            ? "Start work"
            : "Waiting for Hustler to start work";
      case BookingStatus.PAYMENT_PENDING:
        return "Accepted. Payment is required before work begins";
      case BookingStatus.FUNDED:
        return viewerRole === "HUSTLER" ? "Start work" : "Funding confirmed. Waiting for work to begin";
      case BookingStatus.IN_PROGRESS:
        return viewerRole === "HUSTLER" ? "Mark work complete" : "Work is active";
      case BookingStatus.COMPLETED:
        return "Work marked complete";
      case BookingStatus.DECLINED:
        return "Request declined";
      case BookingStatus.CANCELLED:
        return "Booking cancelled";
      case BookingStatus.DISPUTED:
        return "Dispute requires payment/trust operations";
      case BookingStatus.REFUNDED:
        return "Booking refunded";
      case BookingStatus.CLOSED:
        return "Booking closed";
      default:
        return null;
    }
  }

  private async recordEvent(name: string, payload: Prisma.InputJsonObject) {
    await this.prisma.systemEvent.create({
      data: { name, source: "api", payload }
    });
  }

  private validateSchedule(start: Date, end: Date | null, label: string) {
    if (end && end.getTime() <= start.getTime()) {
      throw new BadRequestException(`${label}EndAt must be after ${label}StartAt`);
    }
  }

  private requiredId(value: unknown, field: string) {
    if (typeof value !== "string" || !value.trim() || value.trim().length > 200) {
      throw new BadRequestException(`${field} is required`);
    }
    return value.trim();
  }

  private optionalId(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredId(value, field);
  }

  private requiredText(value: unknown, field: string, max: number) {
    if (typeof value !== "string" || !value.trim()) {
      throw new BadRequestException(`${field} is required`);
    }
    const normalized = value.trim();
    if (normalized.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
    return normalized;
  }

  private optionalText(value: unknown, field: string, max: number) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be text`);
    const normalized = value.trim();
    if (!normalized) return null;
    if (normalized.length > max) throw new BadRequestException(`${field} must be at most ${max} characters`);
    return normalized;
  }

  private requiredDate(value: unknown, field: string) {
    const date = this.optionalDate(value, field);
    if (!date) throw new BadRequestException(`${field} is required`);
    return date;
  }

  private optionalDate(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException(`${field} must be an ISO date-time string`);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} must be a valid ISO date-time string`);
    return date;
  }

  private parseLimit(value: unknown, fallback: number, max: number) {
    if (value === undefined || value === null || value === "") return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
      throw new BadRequestException(`limit must be an integer between 1 and ${max}`);
    }
    return parsed;
  }

  private encodeCursor(timestamp: Date, id: string) {
    return Buffer.from(JSON.stringify({ t: timestamp.toISOString(), id }), "utf8").toString("base64url");
  }

  private decodeCursor(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") throw new BadRequestException("Invalid booking cursor");
    try {
      const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { t?: unknown; id?: unknown };
      if (typeof parsed.t !== "string" || typeof parsed.id !== "string") throw new Error("invalid");
      const timestamp = new Date(parsed.t);
      if (Number.isNaN(timestamp.getTime()) || !parsed.id) throw new Error("invalid");
      return { timestamp, id: parsed.id };
    } catch {
      throw new BadRequestException("Invalid booking cursor");
    }
  }
}
