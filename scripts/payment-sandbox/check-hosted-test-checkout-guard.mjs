import assert from "node:assert/strict";
import { assertHostedTestCheckoutEnvironment, assertHostedTestManifest } from "./hosted-test-checkout-guard.mjs";

const valid = {
  GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "realxpen/hustle-economy-of-you",
  GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main",
  HUSTLE_TEST_CHECKOUT_APPROVAL: "I_AUTHORIZE_HOSTED_TEST_CHECKOUT_ONLY",
  HUSTLE_TEST_CHECKOUT_PHASE: "PREPARE", HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID: "",
  NODE_ENV: "test", HUSTLE_PAYMENT_GATEWAY: "paystack-test",
  DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public",
  PAYSTACK_TEST_SECRET_KEY: "sk_test_OFFLINECONTRACTONLY1234"
};
assert.equal(assertHostedTestCheckoutEnvironment(valid), "PREPARE");
assert.equal(assertHostedTestCheckoutEnvironment({
  ...valid, HUSTLE_TEST_CHECKOUT_PHASE: "VERIFY", HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID: "41137623583"
}), "VERIFY");
const denials = {
  "unsafe default choice": { HUSTLE_TEST_CHECKOUT_APPROVAL: "DO_NOT_RUN" },
  "wrong repo": { GITHUB_REPOSITORY: "other/repo" },
  "wrong ref": { GITHUB_REF: "refs/heads/dev" },
  "not manual": { GITHUB_EVENT_NAME: "pull_request" },
  "not GitHub": { GITHUB_ACTIONS: "false" },
  "wrong mode": { HUSTLE_TEST_CHECKOUT_PHASE: "PAYOUT" },
  "prepare with stale run ID": { HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID: "12345" },
  "live gateway": { HUSTLE_PAYMENT_GATEWAY: "paystack-live" },
  "live key": { PAYSTACK_TEST_SECRET_KEY: "sk_live_NOTALLOWED123456" },
  "no key": { PAYSTACK_TEST_SECRET_KEY: "" },
  "wrong runtime": { NODE_ENV: "production" },
  "isolated staging runtime": { HUSTLE_RUNTIME_SCOPE: "isolated-staging" },
  "unexpected return origin": { PAYSTACK_TEST_RETURN_ORIGIN: "https://example.com" },
  "remote db": { DATABASE_URL: "postgresql://postgres:sandbox_only@db.example.com:55439/hustle_payment_sandbox?schema=public" },
  "staging db": { DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_staging?schema=public" },
  "wrong password": { DATABASE_URL: "postgresql://postgres:production@127.0.0.1:55439/hustle_payment_sandbox?schema=public" },
  "extra options": { DATABASE_URL: valid.DATABASE_URL + "&sslmode=disable" },
  "production secret": { PAYSTACK_SECRET_KEY: "forbidden" },
  "neon credential": { STAGING_AUTH_DATABASE_URL: "forbidden" },
  "AWS key": { AWS_ACCESS_KEY_ID: "forbidden" },
  "wrong verification source": { HUSTLE_TEST_CHECKOUT_PHASE: "VERIFY", HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID: "1e5" }
};
for (const [label, override] of Object.entries(denials)) {
  assert.throws(() => assertHostedTestCheckoutEnvironment({ ...valid, ...override }), /^Error: REFUSED:/, label);
}
const fixture = {
  version: 1, testId: "e3d1f9f8-e3b9-4cb5-83e5-52a0d9be0fe8",
  buyerSubject: "hosted-test-buyer-e3d1f9f8-e3b9-4cb5-83e5-52a0d9be0fe8",
  sellerSubject: "hosted-test-seller-e3d1f9f8-e3b9-4cb5-83e5-52a0d9be0fe8",
  orderId: "order7890", bookingId: "booking7890", orderAttemptId: "pay123456",
  bookingAttemptId: "pay654321", productId: "product7890",
  amountMinor: 10000, currency: "NGN"
};
assert.deepEqual(assertHostedTestManifest(fixture), fixture);
for (const [label, override] of Object.entries({
  "unknown schema": { version: 2 },
  "buyer mismatch": { buyerSubject: "attacker" },
  "missing id": { bookingId: "" },
  "different amount": { amountMinor: 100000 },
  "different currency": { currency: "USD" }
})) {
  assert.throws(() => assertHostedTestManifest({ ...fixture, ...override }), /^Error: REFUSED:/, label);
}
console.log("PASS: hosted test checkout manual authorization, exact local DB, TEST key, original-run and manifest fail-closed guards (" + Object.keys(denials).length + " environment denial cases, five manifest denial cases).");
