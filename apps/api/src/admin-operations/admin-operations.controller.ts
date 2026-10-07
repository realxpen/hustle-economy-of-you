import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";

import { AdminGuard } from "../auth/admin.guard";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";
import { AdminOperationsService } from "./admin-operations.service";

@Controller("admin/operations")
@UseGuards(AuthGuard, AdminGuard)
export class AdminOperationsController {
  constructor(private readonly operations: AdminOperationsService) {}

  @Get("overview")
  overview() {
    return this.operations.overview();
  }

  @Get("users")
  users(
    @Query("q") query?: string,
    @Query("limit") limit?: string
  ) {
    return this.operations.listUsers(query, limit);
  }

  @Get("users/:userId")
  user(@Param("userId") userId: string) {
    return this.operations.userDetail(userId);
  }

  @Get("applications")
  applications(@Query("limit") limit?: string) {
    return this.operations.applicationQueues(limit);
  }

  @Get("bookings")
  bookings(
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.operations.listBookings(status, limit);
  }

  @Get("orders")
  orders(
    @Query("status") status?: string,
    @Query("limit") limit?: string
  ) {
    return this.operations.listOrders(status, limit);
  }

  @Get("finance")
  finance(@Query("limit") limit?: string) {
    return this.operations.financialSnapshot(limit);
  }

  @Get("audit")
  audit(
    @Query("name") name?: string,
    @Query("limit") limit?: string
  ) {
    return this.operations.auditEvents(name, limit);
  }

  @Post("users/:userId/capabilities/:capability/suspend")
  suspendCapability(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("userId") userId: string,
    @Param("capability") capability: string,
    @Body() body: { reason?: unknown }
  ) {
    return this.operations.suspendCapability(
      identity,
      userId,
      capability,
      body.reason
    );
  }

  @Post("users/:userId/capabilities/:capability/reactivate")
  reactivateCapability(
    @CurrentIdentity() identity: AuthIdentity,
    @Param("userId") userId: string,
    @Param("capability") capability: string,
    @Body() body: { reason?: unknown }
  ) {
    return this.operations.reactivateCapability(
      identity,
      userId,
      capability,
      body.reason
    );
  }
}
