import { assertStagingApiIsolation, stagingMutationBlocked } from "../src/common/staging-isolation";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

let serverPromise: Promise<any> | null = null;

async function createServer() {
  // Refuse to bootstrap the staging API without a separately isolated Supabase database.
  assertStagingApiIsolation(process.env);
  try {
    const [{ AppModule }, { AllExceptionsFilter }] = await Promise.all([
      import("../src/app.module"),
      import("../src/common/filters/all-exceptions.filter")
    ]);
    const app = await NestFactory.create(AppModule, { bufferLogs: false });

    app.setGlobalPrefix("api/v1");
    app.use((req: any, res: any, next: () => void) => {
      if (stagingMutationBlocked(process.env, req.method || "", req.url || "")) {
        return res.status(403).json({ error: { code: "STAGING_MUTATION_DISABLED", message: "Nonproduction financial and booking writes are disabled" } });
      }
      next();
    });
    app.enableCors({
      origin: [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN].filter(Boolean) as string[],
      credentials: true
    });
    app.useGlobalFilters(new AllExceptionsFilter());

    await app.init();
    return app.getHttpAdapter().getInstance();
  } catch (error) {
    console.error("HUSTLE_API_BOOTSTRAP_ERROR", error);
    throw error;
  }
}

function getServer() {
  serverPromise ??= createServer().catch((error) => {
    serverPromise = null;
    throw error;
  });
  return serverPromise;
}

function firstString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

export default async function handler(request: any, response: any) {
  try {
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
  } catch (error) {
    console.error("HUSTLE_API_REQUEST_ERROR", error);
    if (!response.headersSent) {
      return response.status(500).json({
        error: {
          code: "API_BOOTSTRAP_FAILED",
          message: "Hustle API could not initialize"
        }
      });
    }
    throw error;
  }
}
