import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";

import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { BookingScheduleService } from "./booking-schedule.service";
import {
  BookingService,
  type AcceptBookingInput,
  type BookingPaginationInput,
  type CancelBookingInput,
  type CreateBookingInput,
  type DeclineBookingInput,
  type ExtendBookingInput,
  type ProposeBookingTimeInput,
  type RespondBookingTimeInput
} from "./booking.service";

@Controller("bookings")
@UseGuards(AuthGuard)
export class BookingController {
  constructor(
    private readonly bookingService: BookingService,
    private readonly bookingScheduleService: BookingScheduleService
  ) {}

  @Post()
  async create(@CurrentIdentity() identity: AuthIdentity, @Body() input: CreateBookingInput) {
    await this.bookingScheduleService.validateCreate(identity, input);
    return this.bookingService.create(identity, input);
  }

  @Get("client")
  listClient(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: BookingPaginationInput
  ) {
    return this.bookingService.listClient(identity, query);
  }

  @Get("hustler")
  listHustler(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: BookingPaginationInput
  ) {
    return this.bookingService.listHustler(identity, query);
  }

  @Get("availability")
  availability(
    @CurrentIdentity() identity: AuthIdentity,
    @Query() query: { serviceId?: unknown; startAt?: unknown; endAt?: unknown; peopleCount?: unknown }
  ) {
    return this.bookingScheduleService.checkAvailability(identity, query);
  }

  @Get("slots")
  slots(@CurrentIdentity() identity: AuthIdentity,
        @Query("serviceId") serviceId: string,
        @Query("date") date: string) {
    return this.bookingScheduleService.listSlots(identity, serviceId, date);
  }

    @Get("duration-insights")
  durationInsights(
    @CurrentIdentity() identity: AuthIdentity,
    @Query("serviceId") serviceId: string
  ) {
    if (!serviceId) return { sampleSize: 0, suggestedDurationMinutes: null };
    return this.bookingScheduleService.durationInsights(identity, serviceId);
  }

  @Get(":bookingId")
  get(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string
  ) {
    return this.bookingService.get(identity, bookingId);
  }

  @Post(":bookingId/accept")
  async accept(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: AcceptBookingInput
  ) {
    // Acceptance checks and commits capacity atomically inside BookingService.
    return this.bookingService.accept(identity, bookingId, input);
  }

  @Post(":bookingId/propose-time")
  proposeTime(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: ProposeBookingTimeInput
  ) {
    return this.bookingService.proposeTime(identity, bookingId, input);
  }

  @Post(":bookingId/respond-time")
  respondTime(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: RespondBookingTimeInput
  ) {
    return this.bookingService.respondTime(identity, bookingId, input);
  }

  @Post(":bookingId/extend")
  extend(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: ExtendBookingInput
  ) {
    return this.bookingService.extend(identity, bookingId, input);
  }

    @Post(":bookingId/decline")
  decline(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: DeclineBookingInput
  ) {
    return this.bookingService.decline(identity, bookingId, input);
  }

  @Post(":bookingId/cancel")
  cancel(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string,
    @Body() input: CancelBookingInput
  ) {
    return this.bookingService.cancel(identity, bookingId, input);
  }

  @Post(":bookingId/start")
  start(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string
  ) {
    return this.bookingService.start(identity, bookingId);
  }

  @Post(":bookingId/complete")
  complete(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("bookingId") bookingId: string
  ) {
    return this.bookingService.complete(identity, bookingId);
  }
}

/** Public capacity for published Services only. Private Booking details stay guarded. */
@Controller("guest/bookings")
export class GuestBookingAvailabilityController {
  constructor(private readonly schedule: BookingScheduleService) {}
  @Get("slots")
  slots(@Query("serviceId") serviceId: string, @Query("date") date: string) {
    return this.schedule.listSlots(null, serviceId, date);
  }
  @Get("availability")
  availability(@Query() query: { serviceId?: unknown; startAt?: unknown; endAt?: unknown; peopleCount?: unknown }) {
    return this.schedule.checkAvailability(null, query);
  }
}
