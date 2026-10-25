import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";

/**
 * Hard fail-closed: only the one throwaway Hustle staging DB or the ephemeral CI
 * Postgres may accept simulated financial operations. No production database,
 * payment provider, bank or arbitrary DB target can reach these methods.
 */
export function assertIsolatedSandboxFinance() {
  if (process.env.HUSTLE_RUNTIME_SCOPE !== "isolated-staging" ||
      process.env.HUSTLE_SANDBOX_FINANCIAL_TESTS_ENABLED !== "true" ||
      process.env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED !== "false") {
    throw new ForbiddenException("Financial simulation is disabled");
  }
  let url: URL;
  try { url = new URL(process.env.DATABASE_URL ?? ""); }
  catch { throw new ForbiddenException("Unknown staging database"); }
  const localCI = process.env.NODE_ENV === "test" &&
    (url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
    url.port === "55439" && url.pathname === "/hustle_payment_sandbox";
  const isolatedNeon = process.env.HUSTLE_STAGING_PROJECT_ID === "summer-sound-54525078" &&
    process.env.HUSTLE_STAGING_BRANCH_ID === "br-dark-sunset-zay33p1s" &&
    url.pathname === "/hustle_staging" &&
    url.hostname.endsWith(".neon.tech") &&
    url.protocol === "postgresql:";
  if (!localCI && !isolatedNeon) {
    throw new ForbiddenException("Only the disposable payment database is permitted");
  }
  if (!process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET ||
      process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET.trim().length < 32) {
    throw new ServiceUnavailableException("Sandbox signing is not configured");
  }
  return process.env.HUSTLE_SANDBOX_WEBHOOK_SECRET.trim();
}
