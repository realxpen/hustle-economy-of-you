import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { stagingRequestAllowed } from "../src/staging-request-policy";

let serverPromise: Promise<any> | null = null;

/**
 * Safe operational diagnostics: only emit known failure categories, never
 * exception messages, URLs, database credentials or request information.
 */
function bootstrapFailureCategory(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message === "Wrong isolated staging authentication issuer or project") return "STAGING_AUTH_CONFIGURATION";
  if (message === "Isolated staging database URL invalid" ||
      message === "Wrong isolated staging database target, schema or TLS configuration") return "STAGING_DATABASE_CONFIGURATION";
  if (message === "Booking submission and financial providers must be disabled") return "UNSAFE_STAGING_FEATURE_FLAGS";
  if (message === "External provider credentials forbidden in isolated staging") return "FORBIDDEN_EXTERNAL_PROVIDER";
  if (message === "Unsupported Hustle runtime scope" ||
      message === "Staging authentication cannot run outside isolated staging") return "INVALID_RUNTIME_SCOPE";
  return "UNCLASSIFIED_BOOTSTRAP_ERROR";
}

function logBootstrapFailure(stage: "startup" | "request", error: unknown) {
  console.error("HUSTLE_API_BOOTSTRAP_DIAGNOSTIC", {
    stage,
    category: bootstrapFailureCategory(error)
  });
}

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
    logBootstrapFailure("startup", error);
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

    const canonicalPath = `${isAuthRequest ? "/api/auth" : "/api/v1"}${normalizedPath ? `/${normalizedPath}` : ""}`;
    if (scope === "isolated-staging" && !stagingRequestAllowed(request.method, canonicalPath)) {
      return response.status(403).json({ error: {
        code: "STAGING_ROUTE_DISABLED", message: "This action is unavailable in isolated staging."
      } });
    }

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
    logBootstrapFailure("request", error);
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
