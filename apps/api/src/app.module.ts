import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { FoundationModule } from "./foundation/foundation.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { HustlerApplicationModule } from "./hustler-application/hustler-application.module";
import { ProfessionalProfileModule } from "./professional-profile/professional-profile.module";
import { ServiceModule } from "./service/service.module";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    DatabaseModule,
    FoundationModule,
    AnalyticsModule,
    AuthModule,
    HustlerApplicationModule,
    ProfessionalProfileModule,
    ServiceModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
