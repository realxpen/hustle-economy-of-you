/**
 * UX040: a manual, two-phase Paystack hosted TEST checkout rehearsal.
 * A new disposable PostgreSQL service is used on each phase. No public API
 * endpoint, production/staging DB, or live payment provider is permitted.
 */
export function assertHostedTestCheckoutEnvironment(env) {
  const refuse = reason => { throw new Error("REFUSED: " + reason); };
  if (env.GITHUB_ACTIONS !== "true" ||
      env.GITHUB_REPOSITORY !== "realxpen/hustle-economy-of-you" ||
      env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_REF !== "refs/heads/main") {
    refuse("GitHub Actions main-only manual workflow required");
  }
  if (env.HUSTLE_TEST_CHECKOUT_APPROVAL !== "I_AUTHORIZE_HOSTED_TEST_CHECKOUT_ONLY") {
    refuse("test checkout was not explicitly authorized");
  }
  const phase = env.HUSTLE_TEST_CHECKOUT_PHASE;
  if (phase !== "PREPARE" && phase !== "VERIFY") refuse("unknown checkout test phase");
  if (phase === "VERIFY" && !/^[1-9][0-9]{4,19}$/.test(env.HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID ?? "")) {
    refuse("verification requires an exact originating GitHub run ID");
  }
  if (phase === "PREPARE" && env.HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID) {
    refuse("prepare cannot restore another workflow run");
  }
  if (env.NODE_ENV !== "test" || env.HUSTLE_PAYMENT_GATEWAY !== "paystack-test" ||
      env.HUSTLE_RUNTIME_SCOPE || env.PAYSTACK_TEST_RETURN_ORIGIN) {
    refuse("only standalone test gateway without an external callback is allowed");
  }
  let db;
  try { db = new URL(env.DATABASE_URL ?? ""); }
  catch { refuse("missing disposable Postgres"); }
  if (db.protocol !== "postgresql:" || db.hostname !== "127.0.0.1" ||
      db.port !== "55439" || db.pathname !== "/hustle_payment_sandbox" ||
      db.username !== "postgres" || db.password !== "sandbox_only" ||
      db.searchParams.get("schema") !== "public" ||
      [...db.searchParams.keys()].some(k => k !== "schema") || db.hash) {
    refuse("only fixed disposable loopback PostgreSQL is authorized");
  }
  if (!/^sk_test_[A-Za-z0-9]{12,}$/.test(env.PAYSTACK_TEST_SECRET_KEY ?? "")) {
    refuse("only a real private Paystack TEST key can run hosted checkout");
  }
  for (const key of [
    "PAYSTACK_SECRET_KEY", "PAYSTACK_LIVE_SECRET_KEY",
    "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "STAGING_AUTH_DATABASE_URL", "NEON_AUTH_BASE_URL", "BETTER_AUTH_SECRET",
    "MONNIFY_API_KEY", "MONIFLOW_PARTNER_HMAC_SECRET",
    "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "VERCEL_TOKEN", "EXPO_TOKEN"
  ]) {
    if (env[key]) refuse("forbidden external or production credential: " + key);
  }
  return phase;
}

export function assertHostedTestManifest(manifest) {
  const refuse = () => { throw new Error("REFUSED: invalid disposable checkout manifest"); };
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest) ||
      manifest.version !== 1 ||
      !/^[0-9a-f-]{36}$/i.test(manifest.testId ?? "") ||
      typeof manifest.buyerSubject !== "string" ||
      manifest.buyerSubject !== "hosted-test-buyer-" + manifest.testId ||
      manifest.sellerSubject !== "hosted-test-seller-" + manifest.testId ||
      !["orderId", "bookingId", "orderAttemptId", "bookingAttemptId", "productId"].every(
        key => typeof manifest[key] === "string" && /^[a-zA-Z0-9_-]{8,80}$/.test(manifest[key])
      ) ||
      manifest.amountMinor !== 10000 || manifest.currency !== "NGN") {
    refuse();
  }
  return manifest;
}
