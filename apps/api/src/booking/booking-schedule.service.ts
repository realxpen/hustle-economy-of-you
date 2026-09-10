import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { BookingStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import type { AcceptBookingInput, CreateBookingInput } from "./booking.service";

const blockingStatuses: BookingStatus[] = [
  BookingStatus.ACCEPTED,
  BookingStatus.PAYMENT_PENDING,
  BookingStatus.FUNDED,
  BookingStatus.IN_PROGRESS
];

@Injectable()
export class BookingScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async validateCreate(identity: AuthIdentity, input: CreateBookingInput) {
    if (typeof input.serviceId !== "string" || !input.serviceId.trim()) return;
    const startAt = this.parseOptionalDate(input.requestedStartAt);
    const endAt = this.parseOptionalDate(input.requestedEndAt);
    if (!startAt) return;
    if (input.requestedEndAt !== undefined && input.requestedEndAt !== null && input.requestedEndAt !== "" && !endAt) return;

    const client = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!client) return;

    const service = await this.prisma.service.findUnique({
      where: { id: input.serviceId.trim() },
      select: {
        id: true,
        professionalProfile: { select: { userId: true } }
      }
    });
    if (!service || service.professionalProfile.userId === client.id) return;

    const duplicate = await this.prisma.booking.findFirst({
      where: {
        serviceId: service.id,
        clientUserId: client.id,
        status: BookingStatus.REQUESTED,
        requestedStartAt: startAt,
        requestedEndAt: endAt
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new ConflictException(
        "You already have a pending booking request for this Service at the same time"
      );
    }

    await this.assertAvailable({
      hustlerUserId: service.professionalProfile.userId,
      startAt,
      endAt
    });
  }

  async validateAccept(
    identity: AuthIdentity,
    bookingId: string,
    input: AcceptBookingInput
  ) {
    const viewer = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!viewer) return;

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        hustlerUserId: true,
        status: true,
        requestedStartAt: true,
        requestedEndAt: true
      }
    });
    if (!booking || booking.hustlerUserId !== viewer.id || booking.status !== BookingStatus.REQUESTED) return;

    const suppliedStart = this.parseOptionalDate(input.confirmedStartAt);
    const suppliedEnd = this.parseOptionalDate(input.confirmedEndAt);
    if (input.confirmedStartAt !== undefined && input.confirmedStartAt !== null && input.confirmedStartAt !== "" && !suppliedStart) return;
    if (input.confirmedEndAt !== undefined && input.confirmedEndAt !== null && input.confirmedEndAt !== "" && !suppliedEnd) return;

    const startAt = suppliedStart ?? booking.requestedStartAt;
    const endAt = input.confirmedEndAt === undefined
      ? booking.requestedEndAt
      : suppliedEnd;

    await this.assertAvailable({
      hustlerUserId: booking.hustlerUserId,
      startAt,
      endAt,
      excludeBookingId: booking.id
    });
  }

  async checkAvailability(
    identity: AuthIdentity,
    input: { serviceId?: unknown; startAt?: unknown; endAt?: unknown }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject },
      select: { id: true }
    });
    if (!user) throw new BadRequestException("Hustle account is not synchronized");

    if (typeof input.serviceId !== "string" || !input.serviceId.trim()) {
      throw new BadRequestException("serviceId is required");
    }
    const startAt = this.requiredDate(input.startAt, "startAt");
    const endAt = this.optionalDate(input.endAt, "endAt");
    if (endAt && endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException("endAt must be after startAt");
    }

    const service = await this.prisma.service.findUnique({
      where: { id: input.serviceId.trim() },
      select: { professionalProfile: { select: { userId: true } } }
    });
    if (!service) throw new BadRequestException("Service is not available");

    const conflict = await this.findConflict(
      service.professionalProfile.userId,
      startAt,
      endAt
    );

    return {
      available: !conflict,
      startAt,
      endAt,
      reason: conflict ? "This time overlaps another confirmed booking for this Hustler" : null
    };
  }

  private async assertAvailable(input: {
    hustlerUserId: string;
    startAt: Date;
    endAt: Date | null;
    excludeBookingId?: string;
  }) {
    const conflict = await this.findConflict(
      input.hustlerUserId,
      input.startAt,
      input.endAt,
      input.excludeBookingId
    );

    if (conflict) {
      throw new ConflictException(
        "This time overlaps another confirmed booking for this Hustler. Choose a different schedule"
      );
    }
  }

  private async findConflict(
    hustlerUserId: string,
    startAt: Date,
    endAt: Date | null,
    excludeBookingId?: string
  ) {
    const rows = await this.prisma.booking.findMany({
      where: {
        hustlerUserId,
        status: { in: blockingStatuses },
        confirmedStartAt: { not: null },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {})
      },
      select: {
        id: true,
        confirmedStartAt: true,
        confirmedEndAt: true
      }
    });

    return rows.find((row) => {
      if (!row.confirmedStartAt) return false;
      return this.rangesOverlap(
        startAt,
        endAt,
        row.confirmedStartAt,
        row.confirmedEndAt
      );
    }) ?? null;
  }

  private rangesOverlap(
    candidateStart: Date,
    candidateEnd: Date | null,
    existingStart: Date,
    existingEnd: Date | null
  ) {
    const aStart = candidateStart.getTime();
    const aEnd = candidateEnd?.getTime() ?? null;
    const bStart = existingStart.getTime();
    const bEnd = existingEnd?.getTime() ?? null;

    if (aEnd !== null && bEnd !== null) {
      return aStart < bEnd && bStart < aEnd;
    }
    if (aEnd === null && bEnd === null) return aStart === bStart;
    if (aEnd === null) return aStart >= bStart && aStart < (bEnd as number);
    return bStart >= aStart && bStart < aEnd;
  }

  private parseOptionalDate(value: unknown) {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private requiredDate(value: unknown, field: string) {
    const date = this.parseOptionalDate(value);
    if (!date) throw new BadRequestException(`${field} must be a valid ISO date-time string`);
    return date;
  }

  private optionalDate(value: unknown, field: string) {
    if (value === undefined || value === null || value === "") return null;
    const date = this.parseOptionalDate(value);
    if (!date) throw new BadRequestException(`${field} must be a valid ISO date-time string`);
    return date;
  }
}
