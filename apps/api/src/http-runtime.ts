import type { INestApplication } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";
import { getExpoStagingAuth } from "./auth/expo-staging-auth.service";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";

/** Explicit staging surface. New mutation routes stay closed until reviewed. */
export function stagingRequestAllowed(method: string, path: string): boolean {
  if (method === "OPTIONS") return true;
  if (method === "GET" || method === "HEAD") {
    return /^\/api\/auth\/(get-session|ok)$/.test(path) ||
      /^\/api\/v1(?:\/(?:health|foundation|auth\/me))?$/.test(path) ||
      /^\/api\/v1\/(?:feed|search|marketplace|services|posts|products|messaging|notifications)(?:\/[A-Za-z0-9_-]+)*$/.test(path);
  }
  if (method === "POST") return /^\/api\/auth\/(sign-up\/email|sign-in\/email|sign-out)$/.test(path) ||
    path === "/api/v1/auth/sync" || path === "/api/v1/messaging/conversations/direct" ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/(?:messages|read|typing)$/.test(path) ||
    /^\/api\/v1\/messaging\/conversations\/[A-Za-z0-9_-]+\/messages\/[A-Za-z0-9_-]+\/context-opened$/.test(path);
  return method === "PATCH" && path === "/api/v1/auth/profile";
}

/** Both the standalone and serverless bootstraps must call this before init. */
export function configureHttpRuntime(app: INestApplication, scope: "production" | "isolated-staging") {
  if (scope === "isolated-staging") {
    app.use((request: any, response: any, next: () => void) => {
      const path = request.url.split("?")[0];
      if (!stagingRequestAllowed(request.method, path)) return response.status(403).json({
        error: { code: "STAGING_ROUTE_DISABLED", message: "This action is unavailable in isolated staging." }
      });
      next();
    });
    app.getHttpAdapter().getInstance().all("/api/auth/*splat", toNodeHandler(getExpoStagingAuth()));
  }
  app.setGlobalPrefix("api/v1");
  const configured = [process.env.WEB_ORIGIN, process.env.ADMIN_ORIGIN]
    .flatMap(value => value?.split(",") ?? []).map(value => value.trim()).filter(Boolean);
  const development = process.env.NODE_ENV === "production" ? [] : ["http://localhost:3001", "http://localhost:3003"];
  app.enableCors({ origin: [...new Set([...configured, ...development])], credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());
}
