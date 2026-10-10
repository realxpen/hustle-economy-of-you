import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AttributionConsentService } from "./attribution-consent.service";

@Module({ imports: [AuthModule], controllers: [AnalyticsController], providers: [AnalyticsService, AttributionConsentService], exports: [AttributionConsentService] })
export class AnalyticsModule {}
