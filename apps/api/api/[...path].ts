import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { AllExceptionsFilter } from "../src/common/filters/all-exceptions.filter";

let serverPromise: Promise<any> | null = null;

async function createServer() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN].filter(Boolean) as string[],
    credentials: true
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.init();
  return app.getHttpAdapter().getInstance();
}

function getServer() {
  serverPromise ??= createServer();
  return serverPromise;
}

export default async function handler(request: any, response: any) {
  const server = await getServer();
  return server(request, response);
}
