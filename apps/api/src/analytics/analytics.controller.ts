import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { AnalyticsService, type CaptureEventInput } from "./analytics.service";

@Controller("events")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Post()
  @HttpCode(202)
  capture(@Body() body: CaptureEventInput) {
    return this.analytics.capture(body);
  }
}
