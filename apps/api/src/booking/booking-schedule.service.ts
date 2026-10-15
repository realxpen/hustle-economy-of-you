import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { BookingOperationMode, BookingStatus, Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import type { AcceptBookingInput, CreateBookingInput } from "./booking.service";

const blockingStatuses: BookingStatus[] = [
  BookingStatus.ACCEPTED, BookingStatus.PAYMENT_PENDING, BookingStatus.FUNDED, BookingStatus.IN_PROGRESS
];

const scheduleSelect = {
  id: true, professionalProfileId: true, bookingMode: true, bookingTimezone: true,
  resourcePoolKey: true, defaultDurationMinutes: true, prepMinutes: true,
  bufferMinutes: true, parallelCapacity: true, overbookingAllowance: true,
  weeklyHours: true, blackoutDates: true, maxActiveJobs: true,
  turnaroundHours: true, autoExtensionMinutes: true,
  professionalProfile: { select: { userId: true } }
} satisfies Prisma.ServiceSelect;

type SchedulingService = Prisma.ServiceGetPayload<{ select: typeof scheduleSelect }>;
type Db = Prisma.TransactionClient | PrismaService;
type WeeklyWindow = { day: number; start: string; end: string };

export type FlowTimeAvailability = {
  available: boolean;
  mode: BookingOperationMode;
  startAt: Date;
  endAt: Date | null;
  remainingCapacity: number;
  capacity: number;
  overbooking: boolean;
  reason: string | null;
  turnaroundHours: number;
};

@Injectable()
export class BookingScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  private parseOptionalDate(value: unknown): Date | null {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  private requiredDate(value: unknown, label: string): Date {
    const parsed = this.parseOptionalDate(value);
    if (!parsed) throw new BadRequestException(`${label} must be a valid ISO date-time string`);
    return parsed;
  }
  private optionalDate(value: unknown, label: string): Date | null {
    if (value === undefined || value === null || value === "") return null;
    return this.requiredDate(value, label);
  }

  private async loadService(db: Db, serviceId: string): Promise<SchedulingService> {
    const service = await db.service.findUnique({
      where: { id: serviceId }, select: scheduleSelect
    });
    if (!service) throw new BadRequestException("Service does not exist");
    return service;
  }

  private effectiveEnd(service: SchedulingService, start: Date, requestedEnd: Date | null) {
    if (service.bookingMode !== BookingOperationMode.APPOINTMENT) return requestedEnd;
    const end = requestedEnd ?? new Date(start.getTime() + service.defaultDurationMinutes * 60_000);
    if (end.getTime() <= start.getTime()) throw new BadRequestException("End must be after start");
    if (end.getTime() - start.getTime() > 24 * 3_600_000) {
      throw new BadRequestException("Appointments may not exceed 24 hours");
    }
    return end;
  }

  private localParts(value: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone, weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(value);
    const field = (name: string) => parts.find((p) => p.type === name)?.value ?? "";
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(field("weekday"));
    return {
      day, clock: field("hour") + ":" + field("minute"),
      date: field("year") + "-" + field("month") + "-" + field("day")
    };
  }

  private checkOperatingHours(service: SchedulingService, start: Date, end: Date | null): string | null {
    if (service.bookingMode !== BookingOperationMode.APPOINTMENT) return null;
    const beginning = this.localParts(start, service.bookingTimezone);
    const finish = this.localParts(end ?? start, service.bookingTimezone);
    if (service.blackoutDates.includes(beginning.date) ||
        (finish.date !== beginning.date && service.blackoutDates.includes(finish.date))) {
      return "This business is unavailable on the selected date";
    }
    // null deliberately preserves existing unconfigured Services; [] means closed.
    if (service.weeklyHours === null) return null;
    if (!Array.isArray(service.weeklyHours)) return "Opening hours need to be configured";
    const windows = service.weeklyHours as WeeklyWindow[];
    const prep = new Date(start.getTime() - service.prepMinutes * 60_000);
    const recovery = new Date((end ?? start).getTime() + service.bufferMinutes * 60_000);
    const before = this.localParts(prep, service.bookingTimezone);
    const after = this.localParts(recovery, service.bookingTimezone);
    if (before.date !== after.date || beginning.date !== after.date) {
      return "The appointment including preparation and cleanup must fit one operating day";
    }
    const fits = windows.some((window) =>
      window.day === beginning.day && before.clock >= window.start && after.clock <= window.end
    );
    return fits ? null : "Selected appointment is outside business opening hours";
  }

  private overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
    return startA < endB && startB < endA;
  }

  private async availabilityForService(
    db: Db, service: SchedulingService, startAt: Date, proposedEnd: Date | null,
    excludeBookingId?: string
  ): Promise<FlowTimeAvailability> {
    const endAt = this.effectiveEnd(service, startAt, proposedEnd);
    if (startAt.getTime() <= Date.now()) {
      return { available: false, mode: service.bookingMode, startAt, endAt,
        capacity: 0, remainingCapacity: 0, overbooking: false,
        turnaroundHours: service.turnaroundHours, reason: "Choose a time in the future" };
    }
    const outside = this.checkOperatingHours(service, startAt, endAt);
    if (outside) {
      return { available: false, mode: service.bookingMode, startAt, endAt,
        capacity: 0, remainingCapacity: 0, overbooking: false,
        turnaroundHours: service.turnaroundHours, reason: outside };
    }

    if (service.bookingMode === BookingOperationMode.CONSULTATION) {
      return { available: true, mode: service.bookingMode, startAt, endAt,
        capacity: 1, remainingCapacity: 1, overbooking: false,
        turnaroundHours: service.turnaroundHours, reason: null };
    }

    const bookings = await db.booking.findMany({
      where: {
        hustlerUserId: service.professionalProfile.userId,
        status: { in: blockingStatuses },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        service: { resourcePoolKey: service.resourcePoolKey }
      },
      select: {
        id: true, confirmedStartAt: true, confirmedEndAt: true,
        service: { select: {
          bookingMode: true, defaultDurationMinutes: true, prepMinutes: true,
          bufferMinutes: true, parallelCapacity: true
        } }
      }
    });

    if (service.bookingMode === BookingOperationMode.WORK_QUEUE) {
      const used = bookings.filter((b) => b.service.bookingMode === BookingOperationMode.WORK_QUEUE).length;
      const remaining = Math.max(0, service.maxActiveJobs - used);
      return { available: remaining > 0, mode: service.bookingMode, startAt, endAt,
        capacity: service.maxActiveJobs, remainingCapacity: remaining, overbooking: false,
        turnaroundHours: service.turnaroundHours,
        reason: remaining ? null : "This Hustler's work queue is at capacity" };
    }

    const candidateStart = new Date(startAt.getTime() - service.prepMinutes * 60_000);
    const candidateEnd = new Date((endAt as Date).getTime() + service.bufferMinutes * 60_000);
    const overlapping = bookings.filter((b) => {
      if (b.service.bookingMode !== BookingOperationMode.APPOINTMENT || !b.confirmedStartAt) return false;
      const actualEnd = b.confirmedEndAt ??
        new Date(b.confirmedStartAt.getTime() + b.service.defaultDurationMinutes * 60_000);
      return this.overlaps(candidateStart, candidateEnd,
        new Date(b.confirmedStartAt.getTime() - b.service.prepMinutes * 60_000),
        new Date(actualEnd.getTime() + b.service.bufferMinutes * 60_000));
    });
    // Shared resource pools must respect the strictest participating Service policy.
    const normalCapacity = Math.min(service.parallelCapacity,
      ...overlapping.map((b) => b.service.parallelCapacity));
    const totalCapacity = normalCapacity + service.overbookingAllowance;
    const remaining = Math.max(0, totalCapacity - overlapping.length);
    return {
      available: remaining > 0, mode: service.bookingMode, startAt, endAt,
      capacity: totalCapacity, remainingCapacity: remaining,
      overbooking: overlapping.length >= normalCapacity,
      turnaroundHours: service.turnaroundHours,
      reason: remaining ? null : "All available capacity for this time is already committed"
    };
  }

  async checkAvailability(
    identity: AuthIdentity,
    input: { serviceId?: unknown; startAt?: unknown; endAt?: unknown }
  ) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject }, select: { id: true }
    });
    if (!user) throw new BadRequestException("Hustle account is not synchronized");
    if (typeof input.serviceId !== "string" || !input.serviceId.trim()) {
      throw new BadRequestException("serviceId is required");
    }
    const start = this.requiredDate(input.startAt, "startAt");
    const end = this.optionalDate(input.endAt, "endAt");
    if (end && end <= start) throw new BadRequestException("endAt must be after startAt");
    const service = await this.loadService(this.prisma, input.serviceId.trim());
    return this.availabilityForService(this.prisma, service, start, end);
  }

  async validateCreate(identity: AuthIdentity, input: CreateBookingInput) {
    if (typeof input.serviceId !== "string" || !input.serviceId.trim()) return;
    const start = this.parseOptionalDate(input.requestedStartAt);
    const end = this.parseOptionalDate(input.requestedEndAt);
    if (!start || (input.requestedEndAt != null && input.requestedEndAt !== "" && !end)) return;
    const client = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject }, select: { id: true }
    });
    if (!client) return;
    const service = await this.loadService(this.prisma, input.serviceId.trim());
    if (service.professionalProfile.userId === client.id) return;

    const duplicate = await this.prisma.booking.findFirst({
      where: { serviceId: service.id, clientUserId: client.id, status: BookingStatus.REQUESTED,
        requestedStartAt: start, requestedEndAt: end },
      select: { id: true }
    });
    if (duplicate) throw new ConflictException("You already requested this Service at this time");

    const result = await this.availabilityForService(this.prisma, service, start, end);
    if (!result.available) throw new ConflictException(result.reason ?? "No capacity available");
    // REQUESTED never holds a slot; another accepted request may take capacity first.
  }

  async validateAccept(identity: AuthIdentity, bookingId: string, input: AcceptBookingInput) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject }, select: { id: true }
    });
    if (user) await this.validateAcceptForHustler(user.id, bookingId, input);
  }
  async validateAcceptForHustler(hustlerUserId: string, bookingId: string, input: AcceptBookingInput) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, hustlerUserId: true, status: true, serviceId: true,
        requestedStartAt: true, requestedEndAt: true }
    });
    if (!booking || booking.hustlerUserId !== hustlerUserId ||
        booking.status !== BookingStatus.REQUESTED) return;
    const start = this.parseOptionalDate(input.confirmedStartAt) ?? booking.requestedStartAt;
    const end = input.confirmedEndAt === undefined ? booking.requestedEndAt : this.parseOptionalDate(input.confirmedEndAt);
    const service = await this.loadService(this.prisma, booking.serviceId);
    const available = await this.availabilityForService(this.prisma, service, start, end, booking.id);
    if (!available.available) throw new ConflictException(available.reason ?? "Capacity is full");
  }

  /** Called from inside the same DB transaction that commits a Booking; serializes a Hustler's resource pools. */
  async reserveWithinTransaction(
    tx: Prisma.TransactionClient, input: {
      serviceId: string; hustlerUserId: string; startAt: Date; endAt: Date | null;
      excludeBookingId?: string;
    }
  ) {
    // PostgreSQL transaction-scoped advisory lock: released on commit/rollback, never global process state.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${input.hustlerUserId}), 19477)`;
    const service = await this.loadService(tx, input.serviceId);
    if (service.professionalProfile.userId !== input.hustlerUserId) {
      throw new ForbiddenException("Service owner mismatch");
    }
    const result = await this.availabilityForService(
      tx, service, input.startAt, input.endAt, input.excludeBookingId
    );
    if (!result.available) throw new ConflictException(result.reason ?? "Booking capacity is full");
    return result;
  }

  async durationInsights(identity: AuthIdentity, serviceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { authSubject: identity.subject }, select: { id: true }
    });
    if (!user) throw new ForbiddenException("Hustle account is not synchronized");
    const service = await this.loadService(this.prisma, serviceId);
    if (service.professionalProfile.userId !== user.id) throw new ForbiddenException("Only the Service owner can view duration insights");
    const rows = await this.prisma.booking.findMany({
      where: { serviceId, status: { in: [BookingStatus.COMPLETED, BookingStatus.CLOSED] },
        actualStartedAt: { not: null }, actualFinishedAt: { not: null } },
      orderBy: { actualFinishedAt: "desc" }, take: 25,
      select: { actualStartedAt: true, actualFinishedAt: true }
    });
    const minutes = rows.map((r) =>
      Math.ceil(((r.actualFinishedAt as Date).getTime() - (r.actualStartedAt as Date).getTime()) / 60_000)
    ).filter((value) => value > 0 && value < 24 * 60).sort((a, b) => a - b);
    const median = minutes.length ? minutes[Math.floor(minutes.length / 2)] : null;
    return {
      sampleSize: minutes.length, medianMinutes: median,
      suggestedDurationMinutes: minutes.length >= 5 && median !== null
        ? Math.max(5, Math.ceil(median / 5) * 5) : null,
      currentDefaultMinutes: service.defaultDurationMinutes
    };
  }
}
