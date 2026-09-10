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
  type DeclineBookingInput
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
    @Query() query: { serviceId?: unknown; startAt?: unknown; endAt?: unknown }
  ) {
    return this.bookingScheduleService.checkAvailability(identity, query);
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
    await this.bookingScheduleService.validateAccept(identity, bookingId, input);
    return this.bookingService.accept(identity, bookingId, input);
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
