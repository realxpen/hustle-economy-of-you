import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { AnalyticsService, type CaptureEventInput } from "./analytics.service";

@Controller("events")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview")
  @UseGuards(AuthGuard, AdminGuard)
  overview(@Query("days") days?: string) {
    return this.analytics.overview(days);
  }

  @Post()
  @HttpCode(202)
  capture(@Body() body: CaptureEventInput) {
    return this.analytics.capture(body);
  }
}
