import assert from "node:assert/strict";
import { assertRealPaystackTestPreflight } from "./real-paystack-preflight-guard.mjs";

const valid = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "realxpen/hustle-economy-of-you",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  PAYSTACK_TEST_PREFLIGHT_CONFIRM: "I_AUTHORIZE_TEST_PROVIDER_INITIALIZE_ONLY",
  NODE_ENV: "test",
  HUSTLE_PAYMENT_GATEWAY: "paystack-test",
  DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public",
  PAYSTACK_TEST_SECRET_KEY: "sk_test_FAKEKEYFOROFFLINECONTRACT"
};
assert.equal(assertRealPaystackTestPreflight(valid), true);
const checks = {
  "missing explicit authorization": { PAYSTACK_TEST_PREFLIGHT_CONFIRM: "DO_NOT_RUN" },
  "wrong repository": { GITHUB_REPOSITORY: "attacker/other-repo" },
  "pull request trigger": { GITHUB_EVENT_NAME: "pull_request" },
  "feature branch": { GITHUB_REF: "refs/heads/feature" },
  "local terminal": { GITHUB_ACTIONS: "false" },
  "non-test runtime": { NODE_ENV: "production" },
  "production gateway": { HUSTLE_PAYMENT_GATEWAY: "live" },
  "production scope": { HUSTLE_RUNTIME_SCOPE: "production" },
  "public callback": { PAYSTACK_TEST_RETURN_ORIGIN: "https://example.com" },
  "remote database": { DATABASE_URL: "postgresql://postgres:sandbox_only@db.example.com:55439/hustle_payment_sandbox?schema=public" },
  "parent staging database": { DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_staging?schema=public" },
  "wrong database user": { DATABASE_URL: "postgresql://hustle_child_api:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public" },
  "wrong port": { DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:5432/hustle_payment_sandbox?schema=public" },
  "wrong password": { DATABASE_URL: "postgresql://postgres:prod@127.0.0.1:55439/hustle_payment_sandbox?schema=public" },
  "extra connection options": { DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public&sslmode=disable" },
  "live key": { PAYSTACK_TEST_SECRET_KEY: "sk_live_NEVERALLOWED123456" },
  "public key": { PAYSTACK_TEST_SECRET_KEY: "pk_test_NEVERALLOWED123456" },
  "missing key": { PAYSTACK_TEST_SECRET_KEY: "" },
  "production Paystack credential": { PAYSTACK_SECRET_KEY: "should-not-exist" },
  "production Supabase credential": { SUPABASE_SERVICE_ROLE_KEY: "should-not-exist" },
  "Neon staging auth credential": { BETTER_AUTH_SECRET: "should-not-exist" },
  "AWS credential": { AWS_ACCESS_KEY_ID: "should-not-exist" },
  "Vercel credential": { VERCEL_TOKEN: "should-not-exist" }
};
for (const [description, change] of Object.entries(checks)) {
  assert.throws(() => assertRealPaystackTestPreflight({ ...valid, ...change }), /^Error: REFUSED:/, description);
}
console.log("PASS: " + Object.keys(checks).length + " protected real Paystack test-mode preflight denial cases and one safe-mode acceptance; no network or credentials.");
