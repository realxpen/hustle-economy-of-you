import { Body, Controller, Get, HttpCode, Post, Put, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { AnalyticsService, type CaptureEventInput } from "./analytics.service";
import { AttributionConsentService } from "./attribution-consent.service";
import { CurrentIdentity } from "../auth/current-identity.decorator";
import type { AuthIdentity } from "../infrastructure/auth/auth.port";

@Controller("events")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService, private readonly consent: AttributionConsentService) {}

  @Get("overview")
  @UseGuards(AuthGuard, AdminGuard)
  overview(@Query("days") days?: string) {
    return this.analytics.overview(days);
  }

  @Get("attribution-consent")
  @UseGuards(AuthGuard)
  status(@CurrentIdentity() identity: AuthIdentity) {
    return this.consent.status(identity);
  }

  @Put("attribution-consent")
  @UseGuards(AuthGuard)
  setConsent(@CurrentIdentity() identity: AuthIdentity, @Body() body: { enabled?: unknown }) {
    return this.consent.set(identity, body);
  }

  @Post()
  @HttpCode(202)
  capture(@Body() body: CaptureEventInput) {
    return this.analytics.capture(body);
  }
}
