/**
 * Safety gate for a MANUAL GitHub Actions Paystack test-mode initialization.
 * Unlike the existing isolated iPhone/Neon staging, this workflow uses a fresh
 * localhost Postgres container and never deploys or completes a checkout.
 *
 * Keep this pure so PR CI can exercise every denial without a test key/network.
 */
export function assertRealPaystackTestPreflight(env) {
  const refuse = (reason) => { throw new Error("REFUSED: " + reason); };
  if (env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY !== "realxpen/hustle-economy-of-you" ||
      env.GITHUB_REF !== "refs/heads/main" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch") {
    refuse("only explicit manual runs from the protected Hustle main branch are allowed");
  }
  if (env.PAYSTACK_TEST_PREFLIGHT_CONFIRM !== "I_AUTHORIZE_TEST_PROVIDER_INITIALIZE_ONLY") {
    refuse("test-only provider initialization was not explicitly authorized");
  }
  if (env.NODE_ENV !== "test" || env.HUSTLE_PAYMENT_GATEWAY !== "paystack-test" ||
      env.HUSTLE_RUNTIME_SCOPE || env.PAYSTACK_TEST_RETURN_ORIGIN) {
    refuse("wrong test gateway/runtime scope or unexpected checkout callback origin");
  }

  // Require a hardcoded disposable database, not Neon/Supabase/production,
  // before requiring Prisma, Nest, or contacting a payment provider.
  let url;
  try { url = new URL(env.DATABASE_URL ?? ""); }
  catch { refuse("no valid disposable localhost database configured"); }
  if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" ||
      url.port !== "55439" || url.pathname !== "/hustle_payment_sandbox" ||
      url.username !== "postgres" || url.password !== "sandbox_only" ||
      url.searchParams.get("schema") !== "public" ||
      [...url.searchParams.keys()].some(key => key !== "schema") ||
      url.hash) {
    refuse("non-disposable database or unexpected connection options");
  }
  for (const key of [
    "PAYSTACK_SECRET_KEY", "PAYSTACK_LIVE_SECRET_KEY", "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_PUBLISHABLE_KEY",
    "MONNIFY_API_KEY", "MONIFLOW_PARTNER_HMAC_SECRET",
    "STAGING_AUTH_DATABASE_URL", "NEON_AUTH_BASE_URL",
    "BETTER_AUTH_SECRET", "VERCEL_TOKEN", "EXPO_TOKEN",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"
  ]) {
    if (env[key]) refuse("unexpected external or production credential: " + key);
  }
  if (!/^sk_test_[A-Za-z0-9]{12,}$/.test(env.PAYSTACK_TEST_SECRET_KEY ?? "")) {
    refuse("a private Paystack TEST secret key is required");
  }
  return true;
}
