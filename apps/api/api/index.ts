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

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export default async function handler(request: any, response: any) {
  const forwardedPath = firstString(request.query?.__hustle_path) ?? "";
  const normalizedPath = forwardedPath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join("/");

  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(request.query ?? {})) {
    if (key === "__hustle_path") continue;
    if (Array.isArray(raw)) {
      for (const value of raw) search.append(key, String(value));
    } else if (raw !== undefined) {
      search.append(key, String(raw));
    }
  }

  request.url = `/api/v1${normalizedPath ? `/${normalizedPath}` : ""}${search.size ? `?${search.toString()}` : ""}`;

  const server = await getServer();
  return server(request, response);
}
