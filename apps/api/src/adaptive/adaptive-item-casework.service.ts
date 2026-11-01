import {
  BadRequestException, ConflictException, ForbiddenException,
  Injectable, NotFoundException
} from "@nestjs/common";
import {
  AdaptiveItemStage, BookingStatus, MarketplaceCasePriority,
  MarketplaceCaseSubjectType, NotificationKind, Prisma
} from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

/**
 * An item delivery objection belongs to the existing MarketplaceCase ledger.
 * No parallel dispute table, settlement operation, or client-accessible admin notes.
 * All participants' statements are immutable AdaptiveItemEvent entries.
 */
@Injectable()
export class AdaptiveItemCaseworkService {
  constructor(private readonly db: PrismaService) {}

  private async context(identity: AuthIdentity, bookingId: string) {
    if (typeof bookingId !== "string" || bookingId.length < 3 || bookingId.length > 140)
      throw new BadRequestException("Invalid booking ID");
    const actor = await this.db.user.findUnique({
      where: { authSubject: identity.subject }, select: { id: true }
    });
    if (!actor) throw new NotFoundException("Hustle account not synchronized");
    const booking = await this.db.booking.findUnique({
      where: { id: bookingId }, select: {
        id: true, status: true, clientUserId: true, hustlerUserId: true,
        service: { select: { adaptiveDraft: { select: {
          blueprint: { select: { slug: true } }
        } } } },
        adaptiveItemFulfillment: { select: {
          id: true, status: true, revision: true, clientConfirmedAt: true
        } }
      }
    });
    if (!booking || booking.service.adaptiveDraft?.blueprint.slug !== "item" ||
        !booking.adaptiveItemFulfillment ||
        (actor.id !== booking.clientUserId && actor.id !== booking.hustlerUserId))
      throw new NotFoundException("Item delivery record not available");
    return { actorId: actor.id, booking, item: booking.adaptiveItemFulfillment };
  }

  private input(value: unknown, min = 20) {
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new BadRequestException("Expected a statement");
    const data = value as Record<string, unknown>;
    const narrative = data.statement;
    if (typeof narrative !== "string" || narrative.trim().length < min ||
        narrative.trim().length > 2000)
      throw new BadRequestException("Statement must be between " + min + " and 2000 characters");
    const evidenceType = data.evidenceType;
    const reference = data.reference;
    const allowed = ["NONE", "COURIER_REFERENCE", "HANDOVER_REFERENCE", "MESSAGE_REFERENCE"];
    if (evidenceType !== undefined && !allowed.includes(String(evidenceType)))
      throw new BadRequestException("Unrecognized supporting reference type");
    if (evidenceType && evidenceType !== "NONE" &&
        (typeof reference !== "string" || reference.trim().length < 3 ||
         reference.trim().length > 180 || /^https?:\/\//i.test(reference.trim())))
      throw new BadRequestException("Enter a short reference ID, not an external URL");
    if ((!evidenceType || evidenceType === "NONE") && reference !== undefined && reference !== "")
      throw new BadRequestException("Choose a reference type first");
    if (typeof data.expectedRevision !== "number" ||
        !Number.isSafeInteger(data.expectedRevision) ||
        data.expectedRevision < 1 || data.expectedRevision > 10000000)
      throw new BadRequestException("expectedRevision must be a positive integer");
    return {
      statement: narrative.trim(),
      evidenceType: (evidenceType ?? "NONE") as string,
      reference: typeof reference === "string" ? reference.trim() : "",
      expectedRevision: data.expectedRevision
    };
  }

  async read(identity: AuthIdentity, bookingId: string) {
    const { actorId, booking, item } = await this.context(identity, bookingId);
    const [record, statements] = await Promise.all([
      this.db.marketplaceCase.findUnique({
        where: { subjectType_subjectId: {
          subjectType: MarketplaceCaseSubjectType.BOOKING, subjectId: bookingId
        } }, select: {
          id: true, status: true, title: true, createdAt: true, resolvedAt: true,
          openedByUserId: true
        }
      }),
      this.db.adaptiveItemEvent.findMany({
        where: { fulfillmentId: item.id, eventType: {
          in: ["item.delivery_claim_opened", "item.delivery_statement"]
        } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 100,
        select: { id: true, eventType: true, actorUserId: true, details: true, createdAt: true }
      })
    ]);
    const itemDelivered: AdaptiveItemStage[] = [AdaptiveItemStage.DELIVERED, AdaptiveItemStage.COLLECTED];
    const claimable: BookingStatus[] = [BookingStatus.FUNDED, BookingStatus.IN_PROGRESS];
    const isDeliveryCase = !!record && record.openedByUserId === booking.clientUserId &&
      record.title === "Item delivery not received";
    return {
      bookingId, bookingStatus: booking.status, itemStatus: item.status,
      expectedRevision: item.revision,
      role: actorId === booking.clientUserId ? "CLIENT" : "HUSTLER",
      canOpen: !record && actorId === booking.clientUserId &&
        claimable.includes(booking.status) && itemDelivered.includes(item.status) &&
        !item.clientConfirmedAt,
      case: isDeliveryCase ? {
        id: record!.id, status: record!.status, createdAt: record!.createdAt,
        resolvedAt: record!.resolvedAt
      } : null,
      hasOtherCase: !!record && !isDeliveryCase,
      statements: isDeliveryCase ? statements.map(({ actorUserId, ...entry }) => ({
        ...entry, author: actorUserId === actorId ? "YOU" : "OTHER"
      })) : [],
      canRespond: isDeliveryCase && booking.status === BookingStatus.DISPUTED &&
        !["RESOLVED", "CLOSED"].includes(record!.status)
    };
  }

  async open(identity: AuthIdentity, bookingId: string, raw: unknown) {
    const ctx = await this.context(identity, bookingId);
    if (ctx.actorId !== ctx.booking.clientUserId)
      throw new ForbiddenException("Only the customer may dispute physical receipt");
    const data = this.input(raw, 30);
    const allowedStatus: BookingStatus[] = [BookingStatus.FUNDED, BookingStatus.IN_PROGRESS];
    const allowedItem: AdaptiveItemStage[] = [AdaptiveItemStage.DELIVERED, AdaptiveItemStage.COLLECTED];
    if (!allowedStatus.includes(ctx.booking.status) || !allowedItem.includes(ctx.item.status) ||
        ctx.item.clientConfirmedAt)
      throw new ConflictException("This delivery claim is not available. Open the booking for its current status");
    try {
      await this.db.$transaction(async tx => {
        const claim = await tx.booking.updateMany({
          where: { id: bookingId, clientUserId: ctx.actorId,
            status: { in: allowedStatus } },
          data: { status: BookingStatus.DISPUTED, disputedAt: new Date() }
        });
        if (claim.count !== 1)
          throw new ConflictException("Booking changed. Refresh before opening a claim");
        const changed = await tx.adaptiveItemFulfillment.updateMany({
          where: { id: ctx.item.id, revision: data.expectedRevision,
            status: { in: allowedItem }, clientConfirmedAt: null },
          data: { revision: { increment: 1 } }
        });
        if (changed.count !== 1)
          throw new ConflictException("Item receipt changed. Refresh before opening a claim");
        const created = await tx.marketplaceCase.create({ data: {
          subjectType: MarketplaceCaseSubjectType.BOOKING,
          subjectId: bookingId, title: "Item delivery not received",
          summary: data.statement, priority: MarketplaceCasePriority.NORMAL,
          openedByUserId: ctx.actorId
        } });
        await tx.adaptiveItemEvent.create({ data: {
          fulfillmentId: ctx.item.id, revision: data.expectedRevision + 1,
          eventType: "item.delivery_claim_opened", actorUserId: ctx.actorId,
          details: { statement: data.statement, evidenceType: data.evidenceType,
            reference: data.reference, caseId: created.id }
        } });
        await tx.systemEvent.create({ data: {
          name: "marketplace_case.delivery_claim_opened", source: "adaptive",
          payload: { caseId: created.id, bookingId, actorUserId: ctx.actorId }
        } });
        await tx.notification.upsert({
          where: { recipientUserId_eventKey: {
            recipientUserId: ctx.booking.hustlerUserId,
            eventKey: "adaptive:delivery-claim:" + bookingId
          } },
          update: {}, create: {
            recipientUserId: ctx.booking.hustlerUserId,
            eventKey: "adaptive:delivery-claim:" + bookingId,
            kind: NotificationKind.BOOKING,
            title: "Customer disputed delivery",
            body: "Your customer says the item was not received. Review their statement in the booking. Hustle casework is required.",
            href: "/bookings/" + bookingId
          }
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("An existing case or statement changed; refresh the booking");
      throw error;
    }
    return this.read(identity, bookingId);
  }

  async statement(identity: AuthIdentity, bookingId: string, raw: unknown) {
    const ctx = await this.context(identity, bookingId);
    const data = this.input(raw, 10);
    if (ctx.booking.status !== BookingStatus.DISPUTED)
      throw new ConflictException("Delivery statements require an active disputed booking");
    await this.db.$transaction(async tx => {
      const record = await tx.marketplaceCase.findUnique({
        where: { subjectType_subjectId: {
          subjectType: MarketplaceCaseSubjectType.BOOKING, subjectId: bookingId
        } }, select: { id: true, status: true, openedByUserId: true, title: true }
      });
      if (!record || record.openedByUserId !== ctx.booking.clientUserId ||
          record.title !== "Item delivery not received" ||
          ["RESOLVED", "CLOSED"].includes(record.status))
        throw new ConflictException("No open item-delivery case is available");
      const booking = await tx.booking.findUnique({
        where: { id: bookingId }, select: { status: true }
      });
      if (booking?.status !== BookingStatus.DISPUTED)
        throw new ConflictException("Booking has changed; refresh");
      const changed = await tx.adaptiveItemFulfillment.updateMany({
        where: { id: ctx.item.id, revision: data.expectedRevision },
        data: { revision: { increment: 1 } }
      });
      if (changed.count !== 1)
        throw new ConflictException("Another participant updated the case; refresh");
      await tx.adaptiveItemEvent.create({ data: {
        fulfillmentId: ctx.item.id, revision: data.expectedRevision + 1,
        eventType: "item.delivery_statement", actorUserId: ctx.actorId,
        details: { statement: data.statement, evidenceType: data.evidenceType,
          reference: data.reference, caseId: record.id }
      } });
      await tx.systemEvent.create({ data: {
        name: "marketplace_case.delivery_statement", source: "adaptive",
        payload: { caseId: record.id, bookingId, actorUserId: ctx.actorId }
      } });
      const recipient = ctx.actorId === ctx.booking.clientUserId
        ? ctx.booking.hustlerUserId : ctx.booking.clientUserId;
      await tx.notification.upsert({ where: { recipientUserId_eventKey: {
        recipientUserId: recipient,
        eventKey: "adaptive:delivery-statement:" + bookingId + ":" + (data.expectedRevision + 1)
      } }, update: {}, create: {
        recipientUserId: recipient,
        eventKey: "adaptive:delivery-statement:" + bookingId + ":" + (data.expectedRevision + 1),
        kind: NotificationKind.BOOKING,
        title: "New delivery-case statement",
        body: "The other participant added a statement. Review the case in your booking.",
        href: "/bookings/" + bookingId
      } });
    });
    return this.read(identity, bookingId);
  }
}
