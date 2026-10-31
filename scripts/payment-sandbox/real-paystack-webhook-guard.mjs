import { assertRealPaystackTestPreflight } from "./real-paystack-preflight-guard.mjs";

/** Exactly the same protected GitHub main, localhost PG and private sk_test_.
 * A new, stronger explicit consent is required to temporarily publish a
 * webhook-only test tunnel and interact with the TEST dashboard. */
export function assertRealPaystackWebhookEnvironment(env) {
  if (env.HUSTLE_TEST_WEBHOOK_APPROVAL !== "I_AUTHORIZE_TEMPORARY_TEST_WEBHOOK_ONLY") {
    throw new Error("REFUSED: explicit temporary TEST webhook authorization required");
  }
  if (env.HUSTLE_TEST_WEBHOOK_TUNNEL !== "quick-tunnel" ||
      env.HUSTLE_TEST_WEBHOOK_PHASE !== "RECEIVE" ||
      env.HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID ||
      env.HUSTLE_RUNTIME_SCOPE || env.PAYSTACK_TEST_RETURN_ORIGIN) {
    throw new Error("REFUSED: only independent temporary test-webhook receipt is supported");
  }
  assertRealPaystackTestPreflight({
    ...env, PAYSTACK_TEST_PREFLIGHT_CONFIRM: "I_AUTHORIZE_TEST_PROVIDER_INITIALIZE_ONLY"
  });
  return true;
}
