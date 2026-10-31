import type { AuthPort } from "../infrastructure/auth/auth.port";
import { ExpoStagingAuthService } from "./expo-staging-auth.service";
import { validatePaymentPreviewRuntime } from "../payment/payment-preview-runtime";

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

/**
 * Only this authorized disposable Neon child has the application and Expo
 * session schemas. The parent staging branch intentionally remains empty.
 * Never infer a default branch or permit the older parent database host.
 */
export const NEON_EXPO_CHILD = Object.freeze({
  branchId: "br-dark-sunset-zay33p1s",
  host: "ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech",
  poolerHost: "ep-cold-smoke-za8u3vsm-pooler.c-2.eu-west-2.aws.neon.tech"
});

export const EXPO_STAGING_AUTH_URL = "https://hustle-isolated-staging-api.vercel.app/api/auth";

// Side-by-side AWS migration: recognize only Function URLs in this one AWS
// account/region. Production and the currently deployed Vercel issuer remain
// unchanged until the isolated iPhone gateway passes live acceptance.
export function isPinnedAwsLambdaStagingAuthUrl(env: NodeJS.ProcessEnv): boolean {
  return env.HUSTLE_AWS_ACCOUNT_ID === "707859598737" &&
    env.AWS_REGION === "eu-west-2" &&
    /^https:\/\/[a-z0-9]{10,64}\.lambda-url\.eu-west-2\.on\.aws\/api\/auth$/.test(env.BETTER_AUTH_URL ?? "");
}

function validateStagingDatabase(value: string | undefined, schema: string) {
  let url: URL;
  try { url = new URL(value ?? ""); }
  catch { throw new Error("Isolated staging database URL invalid"); }
  if (!["postgresql:", "postgres:"].includes(url.protocol) ||
      ![NEON_EXPO_CHILD.host, NEON_EXPO_CHILD.poolerHost].some(host => host === url.hostname) || url.pathname !== "/hustle_staging" ||
      url.username !== "hustle_child_api" ||
      !["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "") ||
      (url.searchParams.get("schema") ?? "public") !== schema ||
      !url.username || !url.password || url.hash || url.port) {
    throw new Error("Wrong isolated staging database target, schema or TLS configuration");
  }
}

/** Must be executed before Nest creates any DB connection. */
export function validateApiRuntimeEnvironment(env: NodeJS.ProcessEnv = process.env): "production" | "isolated-staging" | "payment-preview" {
  if (env.HUSTLE_RUNTIME_SCOPE === "payment-preview") {
    validatePaymentPreviewRuntime(env);
    return "payment-preview";
  }
  if (env.HUSTLE_RUNTIME_SCOPE !== "isolated-staging") {
    if (env.HUSTLE_RUNTIME_SCOPE && env.HUSTLE_RUNTIME_SCOPE !== "production") {
      throw new Error("Unsupported Hustle runtime scope");
    }
    if (env.HUSTLE_AUTH_PROVIDER === "neon-managed" || env.HUSTLE_AUTH_PROVIDER === "expo-better-auth" ||
        env.NEON_AUTH_BASE_URL || env.NEON_AUTH_JWKS_URL || env.STAGING_AUTH_DATABASE_URL ||
        env.BETTER_AUTH_URL || env.BETTER_AUTH_SECRET || env.HUSTLE_STAGING_PROJECT_ID ||
        env.HUSTLE_STAGING_BRANCH_ID) {
      throw new Error("Staging authentication cannot run outside isolated staging");
    }
    return "production";
  }
  if (env.HUSTLE_AUTH_PROVIDER !== "expo-better-auth" ||
      env.HUSTLE_STAGING_PROJECT_ID !== NEON_STAGING.projectId ||
      env.HUSTLE_STAGING_BRANCH_ID !== NEON_EXPO_CHILD.branchId ||
      (env.BETTER_AUTH_URL !== EXPO_STAGING_AUTH_URL && !isPinnedAwsLambdaStagingAuthUrl(env)) || env.NEON_AUTH_BASE_URL || env.NEON_AUTH_JWKS_URL ||
      !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 ||
      !env.HUSTLE_STAGING_TEST_EMAILS?.split(",").every(email => /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(email.trim()))) {
    throw new Error("Wrong isolated staging authentication issuer or project");
  }
  for (const key of [
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "PAYSTACK_SECRET_KEY", "PAYSTACK_TEST_SECRET_KEY", "MONNIFY_API_KEY", "MONIFLOW_PARTNER_HMAC_SECRET",
    "EXPO_TOKEN", "VERCEL_TOKEN"
  ]) {
    if (env[key]) throw new Error("External provider credentials forbidden in isolated staging");
  }
  if (env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== "false" ||
      env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED !== "false") {
    throw new Error("Booking submission and financial providers must be disabled");
  }
  validateStagingDatabase(env.DATABASE_URL, "public");
  validateStagingDatabase(env.STAGING_AUTH_DATABASE_URL, "hustle_auth");
  return "isolated-staging";
}

/** No automatic fallback. Production keeps exactly the existing Supabase AuthPort. */
export function chooseHustleAuthPort(supabase: AuthPort, env: NodeJS.ProcessEnv = process.env): AuthPort {
  const scope = validateApiRuntimeEnvironment(env);
  return scope === "isolated-staging" || scope === "payment-preview"
    ? new ExpoStagingAuthService()
    : supabase;
}
