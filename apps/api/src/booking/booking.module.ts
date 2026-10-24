import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { BookingController, GuestBookingAvailabilityController } from "./booking.controller";
import { BookingFinancialService } from "./booking-financial.service";
import { BookingScheduleService } from "./booking-schedule.service";
import { BookingService } from "./booking.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [BookingController, GuestBookingAvailabilityController],
  providers: [BookingService, BookingScheduleService, BookingFinancialService],
  exports: [BookingService, BookingScheduleService, BookingFinancialService]
})
export class BookingModule {}
