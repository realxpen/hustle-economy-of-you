import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BookingController } from "./booking.controller";
import { BookingScheduleService } from "./booking-schedule.service";
import { BookingService } from "./booking.service";

@Module({
  imports: [AuthModule],
  controllers: [BookingController],
  providers: [BookingService, BookingScheduleService],
  exports: [BookingService]
})
export class BookingModule {}
