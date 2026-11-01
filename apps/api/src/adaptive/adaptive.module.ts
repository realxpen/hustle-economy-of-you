import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module";
import { AuthModule } from "../auth/auth.module";
import { AdaptiveController } from "./adaptive.controller";
import { AdaptiveFeatureGuard } from "./adaptive-feature.guard";
import { AdaptiveService } from "./adaptive.service";
import { AdaptiveRosterService } from "./adaptive-roster.service";
import { AdaptiveBookingOpsService } from "./adaptive-booking-ops.service";

@Module({
  imports: [AuthModule, BookingModule],
  controllers: [AdaptiveController],
  providers: [AdaptiveService, AdaptiveRosterService, AdaptiveBookingOpsService, AdaptiveFeatureGuard],
  exports: [AdaptiveService]
})
export class AdaptiveModule {}
