import { Module } from "@nestjs/common";

import { AuthModule } from "../auth/auth.module";
import { BookingController } from "./booking.controller";
import { BookingFinancialService } from "./booking-financial.service";
import { BookingScheduleService } from "./booking-schedule.service";
import { BookingService } from "./booking.service";

@Module({
  imports: [AuthModule],
  controllers: [BookingController],
  providers: [BookingService, BookingScheduleService, BookingFinancialService],
  exports: [BookingService, BookingFinancialService]
})
export class BookingModule {}
