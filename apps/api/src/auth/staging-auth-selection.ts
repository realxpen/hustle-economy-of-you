import type { AuthPort } from "../infrastructure/auth/auth.port";
import { NeonStagingAuthService } from "./neon-staging-auth.service";

/**
 * Security boundary for an explicitly isolated, disposable Hustle staging API.
 * Deliberately repeats the exact public infrastructure pins of
 * infra/neon/staging/stagingConfig.mjs because apps/api is deployed alone.
 * Never log the database URL or any tokens.
 */
export const NEON_STAGING = Object.freeze({
  projectId: "summer-sound-54525078",
  database: "hustle_staging",
  authBaseUrl: "https://ep-square-sea-zax0gyud.neonauth.c-2.eu-west-2.aws.neon.tech/hustle_staging/auth",
  jwksUrl: "https://ep-square-sea-zax0gyud.neonauth.c-2.eu-west-2.aws.neon.tech/hustle_staging/auth/.well-known/jwks.json",
  hosts: [
    "ep-square-sea-zax0gyud.c-2.eu-west-2.aws.neon.tech",
    "ep-square-sea-zax0gyud-pooler.c-2.eu-west-2.aws.neon.tech"
  ]
});

/** Must be executed before Nest creates any DB connection. */
export function validateApiRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): "production" | "isolated-staging" {
  if (env.HUSTLE_RUNTIME_SCOPE !== "isolated-staging") {
    if (env.HUSTLE_RUNTIME_SCOPE && env.HUSTLE_RUNTIME_SCOPE !== "production") {
      throw new Error("Unsupported Hustle runtime scope");
    }
    if (env.HUSTLE_AUTH_PROVIDER === "neon-managed" || env.NEON_AUTH_BASE_URL || env.NEON_AUTH_JWKS_URL ||
        env.HUSTLE_STAGING_PROJECT_ID) {
      throw new Error("Staging authentication cannot run outside isolated staging");
    }
    return "production";
  }
  if (env.HUSTLE_AUTH_PROVIDER !== "neon-managed" ||
      env.HUSTLE_STAGING_PROJECT_ID !== NEON_STAGING.projectId ||
      env.NEON_AUTH_BASE_URL !== NEON_STAGING.authBaseUrl ||
      env.NEON_AUTH_JWKS_URL !== NEON_STAGING.jwksUrl) {
    throw new Error("Wrong isolated staging authentication issuer or project");
  }
  for (const key of [
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY", "MONNIFY_API_KEY", "MONIFLOW_PARTNER_HMAC_SECRET",
    "EXPO_TOKEN", "VERCEL_TOKEN"
  ]) {
    if (env[key]) throw new Error("External provider credentials forbidden in isolated staging");
  }
  if (env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== "false" ||
      env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED !== "false") {
    throw new Error("Booking submission and financial providers must be disabled");
  }
  let url: URL;
  try { url = new URL(env.DATABASE_URL ?? ""); }
  catch { throw new Error("Isolated staging database URL invalid"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) ||
      !NEON_STAGING.hosts.includes(url.hostname) ||
      url.pathname !== "/hustle_staging" ||
      !["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "") ||
      !url.username || !url.password || url.hash || url.port) {
    throw new Error("Wrong isolated staging database target or TLS configuration");
  }
  return "isolated-staging";
}

/** No automatic fallback. Production keeps exactly the existing Supabase AuthPort. */
export function chooseHustleAuthPort(supabase: AuthPort, env: NodeJS.ProcessEnv = process.env): AuthPort {
  return validateApiRuntimeEnvironment(env) === "isolated-staging"
    ? new NeonStagingAuthService()
    : supabase;
}
