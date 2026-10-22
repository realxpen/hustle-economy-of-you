import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

let serverPromise: Promise<any> | null = null;

async function createServer() {
  try {
    const { validateApiRuntimeEnvironment } = await import("../src/auth/staging-auth-selection");
    const scope = validateApiRuntimeEnvironment(process.env);
    const [{ AppModule }, { configureHttpRuntime }] = await Promise.all([
      import("../src/app.module"),
      import("../src/http-runtime")
    ]);
    const app = await NestFactory.create(AppModule, { bufferLogs: false, rawBody: true });
    configureHttpRuntime(app, scope);

    await app.init();
    return app.getHttpAdapter().getInstance();
  } catch (error) {
    console.error("HUSTLE_API_BOOTSTRAP_ERROR");
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
    const authPath = firstString(request.query?.__hustle_auth_path);
    const forwardedPath = authPath ?? firstString(request.query?.__hustle_path) ?? "";
    const normalizedPath = forwardedPath
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
      .join("/");

    const search = new URLSearchParams();
    for (const [key, raw] of Object.entries(request.query ?? {})) {
      if (key === "__hustle_path" || key === "__hustle_auth_path") continue;
      if (Array.isArray(raw)) {
        for (const value of raw) search.append(key, String(value));
      } else if (raw !== undefined) {
        search.append(key, String(raw));
      }
    }

    request.url = `${authPath === undefined ? "/api/v1" : "/api/auth"}${normalizedPath ? `/${normalizedPath}` : ""}${search.size ? `?${search.toString()}` : ""}`;

    const server = await getServer();
    return server(request, response);
  } catch (error) {
    console.error("HUSTLE_API_REQUEST_ERROR");
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
