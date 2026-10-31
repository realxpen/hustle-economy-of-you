import { BadRequestException, ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { BookingOperationMode, BookingStatus, Prisma, ServiceStatus } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import type { AcceptBookingInput, CreateBookingInput } from "./booking.service";

const blockingStatuses: BookingStatus[] = [
  BookingStatus.ACCEPTED, BookingStatus.PAYMENT_PENDING, BookingStatus.FUNDED, BookingStatus.IN_PROGRESS
];

const scheduleSelect = {
  id: true, status: true, professionalProfileId: true, bookingMode: true, bookingTimezone: true,
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

  private parsePartySize(input: unknown): number {
    const size = input === undefined || input === null || input === "" ? 1 : Number(input);
    if (!Number.isSafeInteger(size) || size < 1 || size > 50) {
      throw new BadRequestException("partySize must be an integer between 1 and 50");
    }
    return size;
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
    const windows = service.weeklyHours as unknown as WeeklyWindow[];
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
    excludeBookingId?: string, allowExistingStart = false, partySize = 1
  ): Promise<FlowTimeAvailability> {
    const endAt = this.effectiveEnd(service, startAt, proposedEnd);
    if (!allowExistingStart && startAt.getTime() <= Date.now()) {
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
        id: true, partySize: true, confirmedStartAt: true, confirmedEndAt: true,
        service: { select: {
          bookingMode: true, defaultDurationMinutes: true, prepMinutes: true,
          bufferMinutes: true, parallelCapacity: true, maxActiveJobs: true
        } }
      }
    });

    if (service.bookingMode === BookingOperationMode.WORK_QUEUE) {
      const queued = bookings.filter((b) => b.service.bookingMode === BookingOperationMode.WORK_QUEUE);
      const maxJobs = Math.min(service.maxActiveJobs, ...queued.map((b) => b.service.maxActiveJobs));
      const used = queued.length;
      const remaining = Math.max(0, maxJobs - used);
      return { available: remaining > 0, mode: service.bookingMode, startAt, endAt,
        capacity: maxJobs, remainingCapacity: remaining, overbooking: false,
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
    // Peak concurrent occupancy matters: two non-overlapping clients inside a
    // long requested interval consume only one slot at any instant.
    const events: { at: number; change: number }[] = [];
    for (const row of overlapping) {
      const begin = new Date(row.confirmedStartAt!.getTime() - row.service.prepMinutes * 60_000).getTime();
      const finish = (row.confirmedEndAt ??
        new Date(row.confirmedStartAt!.getTime() + row.service.defaultDurationMinutes * 60_000)).getTime() +
        row.service.bufferMinutes * 60_000;
      events.push({ at: Math.max(begin, candidateStart.getTime()), change: b.partySize ?? 1 });
      events.push({ at: Math.min(finish, candidateEnd.getTime()), change: -(b.partySize ?? 1) });
    }
    events.sort((a,b)=>a.at - b.at || a.change - b.change);
    let active = 0, peak = 0;
    for (const event of events) { active += event.change; peak = Math.max(peak, active); }
    const remaining = Math.max(0, totalCapacity - peak);
    return {
      available: remaining >= partySize, mode: service.bookingMode, startAt, endAt,
      capacity: totalCapacity, remainingCapacity: remaining,
      overbooking: peak >= normalCapacity,
      turnaroundHours: service.turnaroundHours,
      reason: remaining >= partySize ? null : "Not enough staff capacity for this party size at the selected time"
    };
  }

  async checkAvailability(
    identity: AuthIdentity | null,
    input: { serviceId?: unknown; startAt?: unknown; endAt?: unknown; partySize?: unknown }
  ) {
    if (identity) {
      const user = await this.prisma.user.findUnique({
        where: { authSubject: identity.subject }, select: { id: true }
      });
      if (!user) throw new BadRequestException("Hustle account is not synchronized");
    }
    if (typeof input.serviceId !== "string" || !input.serviceId.trim()) {
      throw new BadRequestException("serviceId is required");
    }
    const start = this.requiredDate(input.startAt, "startAt");
    const end = this.optionalDate(input.endAt, "endAt");
    if (end && end <= start) throw new BadRequestException("endAt must be after startAt");
    const service = await this.loadService(this.prisma, input.serviceId.trim());
    if (service.status !== ServiceStatus.PUBLISHED) throw new BadRequestException("Service is not currently public");
    return this.availabilityForService(this.prisma, service, start, end, undefined, false, this.parsePartySize(input.partySize));
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

    const result = await this.availabilityForService(this.prisma, service, start, end, undefined, false, this.parsePartySize(input.partySize));
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
      excludeBookingId?: string; allowExistingStart?: boolean; partySize?: number;
    }
  ) {
    // PostgreSQL transaction-scoped advisory lock: released on commit/rollback, never global process state.
    const locks = await tx.$queryRaw<{ acquired: boolean }[]>`SELECT pg_try_advisory_xact_lock(hashtext(${input.hustlerUserId}), 19477) AS acquired`;
    if (!locks[0]?.acquired) throw new ConflictException("Booking schedule is being updated. Retry shortly");
    const service = await this.loadService(tx, input.serviceId);
    if (service.professionalProfile.userId !== input.hustlerUserId) {
      throw new ForbiddenException("Service owner mismatch");
    }
    const result = await this.availabilityForService(
      tx, service, input.startAt, input.endAt, input.excludeBookingId, input.allowExistingStart ?? false, this.parsePartySize(input.partySize)
    );
    if (!result.available) throw new ConflictException(result.reason ?? "Booking capacity is full");
    return result;
  }

  private zonedInstant(date: string, clock: string, timeZone: string) {
    const target = Date.parse(date + "T" + clock + ":00Z");
    // Resolve local wall clock against IANA offsets, including DST transitions.
    const offsetAt = (probe: number) => {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone, year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", hourCycle: "h23"
      }).formatToParts(new Date(probe));
      const field = (name: string) => parts.find((p) => p.type === name)?.value ?? "00";
      const localAsUtc = Date.UTC(+field("year"), +field("month") - 1, +field("day"), +field("hour"), +field("minute"));
      return localAsUtc - probe;
    };
    const first = target - offsetAt(target);
    const resolved = target - offsetAt(first);
    const formatted = this.localParts(new Date(resolved), timeZone);
    return formatted.date === date && formatted.clock === clock ? new Date(resolved) : null;
  }

  async listSlots(identity: AuthIdentity | null, serviceId: string, date: string) {
    if (identity) {
      const user = await this.prisma.user.findUnique({
        where: { authSubject: identity.subject }, select: { id: true }
      });
      if (!user) throw new BadRequestException("Hustle account is not synchronized");
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date + "T00:00:00Z")) ||
        new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date) {
      throw new BadRequestException("Choose a valid calendar day");
    }
    const dayOffset = (Date.parse(date + "T00:00:00Z") - Date.now()) / 86_400_000;
    if (dayOffset < -1 || dayOffset > 90) throw new BadRequestException("Choose a day within the next 90 days");
    const service = await this.loadService(this.prisma, serviceId);
    if (service.status !== ServiceStatus.PUBLISHED) throw new BadRequestException("Service is not currently public");
    if (service.bookingMode !== BookingOperationMode.APPOINTMENT) {
      return { mode: service.bookingMode, date, timezone: service.bookingTimezone,
        turnaroundHours: service.turnaroundHours, slots: [] };
    }
    const day = new Date(date + "T00:00:00Z").getUTCDay();
    const windows = service.weeklyHours === null
      ? [{ day, start: "09:00", end: "18:00" }]
      : Array.isArray(service.weeklyHours) ? service.weeklyHours as unknown as WeeklyWindow[] : [];
    const slots: { startAt: string; endAt: string | null; remainingCapacity: number;
      available: boolean; overbooking: boolean }[] = [];
    // Return 30-minute entry opportunities. Work duration and buffers remain Service-specific.
    for (const window of windows.filter((item) => item.day === day)) {
      const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
      for (let at = minutes(window.start); at + service.defaultDurationMinutes <= minutes(window.end); at += 30) {
        const clock = String(Math.floor(at / 60)).padStart(2, "0") + ":" + String(at % 60).padStart(2, "0");
        const start = this.zonedInstant(date, clock, service.bookingTimezone);
        if (!start || start.getTime() <= Date.now()) continue;
        const availability = await this.availabilityForService(this.prisma, service, start, null);
        slots.push({ startAt: start.toISOString(),
          endAt: availability.endAt?.toISOString() ?? null,
          remainingCapacity: availability.remainingCapacity,
          available: availability.available, overbooking: availability.overbooking });
        if (slots.length >= 72) break;
      }
      if (slots.length >= 72) break;
    }
    return { mode: service.bookingMode, date, timezone: service.bookingTimezone,
      configuredHours: service.weeklyHours !== null,
      turnaroundHours: service.turnaroundHours, slots };
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
