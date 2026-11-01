import { Module } from "@nestjs/common";
import { BookingModule } from "../booking/booking.module";
import { AuthModule } from "../auth/auth.module";
import { AdaptiveController, GuestAdaptiveGroupController } from "./adaptive.controller";
import { AdaptiveFeatureGuard } from "./adaptive-feature.guard";
import { AdaptiveService } from "./adaptive.service";
import { AdaptiveRosterService } from "./adaptive-roster.service";
import { AdaptiveBookingOpsService } from "./adaptive-booking-ops.service";
import { AdaptiveGroupService } from "./adaptive-group.service";
import { AdaptiveItemCaseworkService } from "./adaptive-item-casework.service";

@Module({
  imports: [AuthModule, BookingModule],
  controllers: [AdaptiveController, GuestAdaptiveGroupController],
  providers: [AdaptiveService, AdaptiveRosterService, AdaptiveBookingOpsService, AdaptiveGroupService, AdaptiveItemCaseworkService, AdaptiveFeatureGuard],
  exports: [AdaptiveService]
})
export class AdaptiveModule {}
