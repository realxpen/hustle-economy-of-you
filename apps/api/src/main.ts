import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateApiRuntimeEnvironment } from "./auth/staging-auth-selection";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { getExpoStagingAuth } from "./auth/expo-staging-auth.service";
import { toNodeHandler } from "better-auth/node";
import { stagingRequestGate } from "./staging-request-policy";
import { paymentPreviewRequestGate } from "./payment/payment-preview-request-policy";

async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    try {
      process.loadEnvFile?.();
    } catch {
      // Local .env loading is best-effort; deployed environments inject variables directly.
    }
  }

  // Fail before Nest initializes Prisma or any provider integration.
  const scope = validateApiRuntimeEnvironment(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  // Before Nest registers its JSON parser. Other routes retain Nest raw-body behavior.
  if (scope === "isolated-staging" || scope === "payment-preview") {
    app.use(scope === "isolated-staging" ? stagingRequestGate : paymentPreviewRequestGate);
    app.getHttpAdapter().getInstance().all("/api/auth/*splat", toNodeHandler(getExpoStagingAuth()));
  }
  app.setGlobalPrefix("api/v1");

  const configuredOrigins = [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN]
    .flatMap((value) => value?.split(",") ?? [])
    .map((origin) => origin.trim())
    .filter((origin): origin is string => Boolean(origin));

  const developmentOrigins = process.env.NODE_ENV === "production"
    ? []
    : ["http://localhost:3001", "http://localhost:3003"];

  const allowedOrigins = [...new Set([...configuredOrigins, ...developmentOrigins])];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(Number(process.env.PORT ?? 4000));
}
bootstrap();
