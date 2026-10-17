import { assertStagingApiIsolation, stagingMutationBlocked } from "./common/staging-isolation";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  if (process.env.NODE_ENV !== "production") {
    try {
      process.loadEnvFile?.();
    } catch {
      // Local .env loading is best-effort; deployed environments inject variables directly.
    }
  }

  assertStagingApiIsolation(process.env);
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.use((req: any, res: any, next: () => void) => {
    if (stagingMutationBlocked(process.env, req.method || "", req.url || "")) {
      return res.status(403).json({ error: { code: "STAGING_MUTATION_DISABLED", message: "Nonproduction financial and booking writes are disabled" } });
    }
    next();
  });
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
