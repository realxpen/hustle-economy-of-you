import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards
} from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AdminSafetyService, type UpdateSafetyReportInput } from "./admin-safety.service";

@Controller("admin/trust-safety")
@UseGuards(AuthGuard, AdminGuard)
export class AdminSafetyController {
  constructor(private readonly adminSafety: AdminSafetyService) {}

  @Get("overview")
  overview() {
    return this.adminSafety.overview();
  }

  @Get("reports")
  reports(@Query("status") status?: string, @Query("limit") limit?: string) {
    return this.adminSafety.listReports(status, limit);
  }

  @Get("users/:userId/summary")
  userSummary(@Param("userId") userId: string) {
    return this.adminSafety.userSummary(userId);
  }

  @Patch("reports/:reportId")
  updateReport(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("reportId") reportId: string,
    @Body() input: UpdateSafetyReportInput
  ) {
    return this.adminSafety.updateReport(identity, reportId, input);
  }
}
