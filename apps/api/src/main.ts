import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.setGlobalPrefix("api/v1");

  const configuredOrigins = [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN]
    .map((origin) => origin?.trim())
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
