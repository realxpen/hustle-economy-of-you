import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateApiRuntimeEnvironment } from "./auth/staging-auth-selection";
import { configureHttpRuntime } from "./http-runtime";

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
  configureHttpRuntime(app, scope);
  await app.listen(Number(process.env.PORT ?? 4000));
}
bootstrap();
