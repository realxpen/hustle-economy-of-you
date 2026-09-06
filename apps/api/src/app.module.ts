import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { DatabaseModule } from "./database/database.module";
import { FoundationModule } from "./foundation/foundation.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { RequestContextMiddleware } from "./common/middleware/request-context.middleware";

@Module({ imports: [DatabaseModule, FoundationModule, AnalyticsModule, AuthModule] })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*");
  }
}
