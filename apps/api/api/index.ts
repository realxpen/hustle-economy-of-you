import "reflect-metadata";
import { NestFactory } from "@nestjs/core";

let serverPromise: Promise<any> | null = null;

async function createServer() {
  try {
    // The Vercel handler does NOT execute src/main.ts. Check the exact child
    // branch and disabled payment flags before constructing Nest/Prisma.
    const { validateApiRuntimeEnvironment } = await import("../src/auth/staging-auth-selection");
    validateApiRuntimeEnvironment(process.env);
    const [{ AppModule }, { AllExceptionsFilter }] = await Promise.all([
      import("../src/app.module"),
      import("../src/common/filters/all-exceptions.filter")
    ]);
    const app = await NestFactory.create(AppModule, { bufferLogs: false });

    app.setGlobalPrefix("api/v1");
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
    const { validateApiRuntimeEnvironment } = await import("../src/auth/staging-auth-selection");
    const scope = validateApiRuntimeEnvironment(process.env);
    const authPath = firstString(request.query?.__hustle_auth_path);
    const isAuthRequest = authPath !== undefined;
    const forwardedPath = isAuthRequest ? authPath : firstString(request.query?.__hustle_path) ?? "";
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

    if (isAuthRequest) {
      // Opt-in test identity is NEVER routed via production Supabase or
      // an unverified JWT. Better Auth receives the original /api/auth path,
      // prior to any Nest JSON body parser.
      if (scope !== "isolated-staging") {
        return response.status(404).json({ error: { code: "NOT_FOUND" } });
      }
      request.url = `/api/auth${normalizedPath ? `/${normalizedPath}` : ""}${search.size ? `?${search.toString()}` : ""}`;
      const [{ getExpoStagingAuth }, { toNodeHandler }] = await Promise.all([
        import("../src/auth/expo-staging-auth.service"),
        import("better-auth/node")
      ]);
      return toNodeHandler(getExpoStagingAuth())(request, response);
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
