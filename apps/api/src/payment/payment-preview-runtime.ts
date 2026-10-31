/**
 * UX042: A distinct, NOT-YET-DEPLOYED payment-preview runtime.
 *
 * Never use the finance-disabled iPhone staging Neon child or a production DB.
 * The dedicated nonproduction Neon project/branch must be independently
 * provisioned and its host pinned by a reviewed protected deployment config.
 * These checks run before Nest initializes Prisma or touches any provider.
 */
const existingStagingHosts = new Set([
  "ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech",
  "ep-cold-smoke-za8u3vsm-pooler.c-2.eu-west-2.aws.neon.tech",
  "ep-square-sea-zax0gyud.c-2.eu-west-2.aws.neon.tech",
  "ep-square-sea-zax0gyud-pooler.c-2.eu-west-2.aws.neon.tech"
]);

function requireOrigin(value: string | undefined, prefix: string): URL {
  let origin: URL;
  try { origin = new URL(value ?? ""); } catch { throw new Error("Invalid isolated payment preview origin"); }
  if (origin.protocol !== "https:" || origin.origin !== value ||
      !origin.hostname.startsWith(prefix) ||
      !origin.hostname.endsWith(".realxpens.workers.dev") ||
      origin.username || origin.password || origin.port || origin.search || origin.hash) {
    throw new Error("Unapproved isolated payment preview origin");
  }
  return origin;
}

function requireDedicatedDatabase(value: string | undefined, host: string, schema: string): void {
  let url: URL;
  try { url = new URL(value ?? ""); } catch { throw new Error("Payment preview database target missing"); }
  const keys = [...url.searchParams.keys()];
  if (url.protocol !== "postgresql:" || url.hostname !== host ||
      url.pathname !== "/hustle_payment_preview" ||
      url.username !== "hustle_payment_preview_api" || !url.password ||
      url.password.length < 16 || url.port || url.hash ||
      url.searchParams.get("sslmode") !== "require" ||
      url.searchParams.get("schema") !== schema ||
      keys.some(key => !["sslmode", "schema"].includes(key))) {
    throw new Error("Payment preview must use dedicated TLS-protected Neon database and role");
  }
}

/** Fail closed unless a completely separate payment test environment exists. */
export function validatePaymentPreviewRuntime(env: NodeJS.ProcessEnv): void {
  if (env.HUSTLE_RUNTIME_SCOPE !== "payment-preview" ||
      env.HUSTLE_PAYMENT_PREVIEW_APPROVAL !== "I_AUTHORIZE_SEPARATE_TEST_PREVIEW_ONLY" ||
      env.NODE_ENV !== "production" ||
      env.HUSTLE_AUTH_PROVIDER !== "expo-better-auth" ||
      env.HUSTLE_PAYMENT_GATEWAY !== "paystack-test" ||
      env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED !== "test-only") {
    throw new Error("Payment preview is not explicitly isolated and test-only");
  }
  for (const key of [
    "PAYSTACK_SECRET_KEY", "PAYSTACK_LIVE_SECRET_KEY", "SUPABASE_URL",
    "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "MONNIFY_API_KEY", "MONIFLOW_PARTNER_HMAC_SECRET",
    "NEON_AUTH_BASE_URL", "NEON_AUTH_JWKS_URL",
    "HUSTLE_STAGING_PROJECT_ID", "HUSTLE_STAGING_BRANCH_ID",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"
  ]) {
    if (env[key]) throw new Error("Staging/production configuration forbidden in payment preview");
  }
  const host = env.HUSTLE_PAYMENT_PREVIEW_DB_HOST ?? "";
  if (!/^ep-[a-z0-9-]+\.c-2\.eu-west-2\.aws\.neon\.tech$/.test(host) ||
      existingStagingHosts.has(host) || /(?:production|prod|primary|main)/i.test(host)) {
    throw new Error("Payment preview requires a separately pinned, non-staging Neon host");
  }
  const project = env.HUSTLE_PAYMENT_PREVIEW_PROJECT_ID ?? "";
  const branch = env.HUSTLE_PAYMENT_PREVIEW_BRANCH_ID ?? "";
  if (!/^[a-z][a-z0-9-]{8,60}$/.test(project) || project === "summer-sound-54525078" ||
      !/^br-[a-z0-9-]{8,80}$/.test(branch) || branch === "br-dark-sunset-zay33p1s") {
    throw new Error("Payment preview must have a distinct reviewed Neon project and branch");
  }
  requireDedicatedDatabase(env.DATABASE_URL, host, "public");
  requireDedicatedDatabase(env.STAGING_AUTH_DATABASE_URL, host, "payment_auth");

  const api = requireOrigin(env.HUSTLE_PAYMENT_PREVIEW_API_ORIGIN, "hustle-payment-preview-api.");
  const web = requireOrigin(env.HUSTLE_PAYMENT_PREVIEW_WEB_ORIGIN, "hustle-payment-preview.");
  if (api.origin === web.origin || env.WEB_ORIGIN !== web.origin ||
      env.BETTER_AUTH_URL !== api.origin + "/api/auth" ||
      env.PAYSTACK_TEST_RETURN_ORIGIN !== web.origin ||
      !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 ||
      !env.PAYSTACK_TEST_SECRET_KEY ||
      !/^sk_test_[A-Za-z0-9]{12,}$/.test(env.PAYSTACK_TEST_SECRET_KEY) ||
      !env.HUSTLE_STAGING_TEST_EMAILS) {
    throw new Error("Missing separate payment preview identity/provider configuration");
  }
  const emails = env.HUSTLE_STAGING_TEST_EMAILS.split(",").map(x => x.trim().toLowerCase());
  if (emails.length > 10 || !emails.every(x => /^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(x))) {
    throw new Error("Payment preview requires up to ten explicitly invited test accounts");
  }
}
