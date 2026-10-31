import assert from "node:assert/strict";
import { assertRealPaystackWebhookEnvironment } from "./real-paystack-webhook-guard.mjs";

const env = {
  GITHUB_ACTIONS: "true",
  GITHUB_REPOSITORY: "realxpen/hustle-economy-of-you",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  HUSTLE_TEST_WEBHOOK_APPROVAL: "I_AUTHORIZE_TEMPORARY_TEST_WEBHOOK_ONLY",
  HUSTLE_TEST_WEBHOOK_TUNNEL: "quick-tunnel",
  HUSTLE_TEST_WEBHOOK_PHASE: "RECEIVE",
  NODE_ENV: "test",
  HUSTLE_PAYMENT_GATEWAY: "paystack-test",
  DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public",
  PAYSTACK_TEST_SECRET_KEY: "sk_test_FAKEOFFLINEONLY12345"
};
assert.equal(assertRealPaystackWebhookEnvironment(env), true);
const denial = {
  "missing approval": { HUSTLE_TEST_WEBHOOK_APPROVAL: "DO_NOT_RUN" },
  "different repository": { GITHUB_REPOSITORY: "some/repo" },
  "untrusted branch": { GITHUB_REF: "refs/heads/development" },
  "PR event": { GITHUB_EVENT_NAME: "pull_request" },
  "local bypass": { GITHUB_ACTIONS: "false" },
  "wrong tunnel": { HUSTLE_TEST_WEBHOOK_TUNNEL: "production" },
  "wrong phase": { HUSTLE_TEST_WEBHOOK_PHASE: "DEPLOY" },
  "reusing other payment run": { HUSTLE_TEST_CHECKOUT_SOURCE_RUN_ID: "41141878952" },
  "staging scope": { HUSTLE_RUNTIME_SCOPE: "isolated-staging" },
  "non-local Postgres": { DATABASE_URL: "postgresql://postgres:sandbox_only@remote.example:55439/hustle_payment_sandbox?schema=public" },
  "staging database": { DATABASE_URL: "postgresql://postgres:sandbox_only@127.0.0.1:55439/staging?schema=public" },
  "live key": { PAYSTACK_TEST_SECRET_KEY: "sk_live_FAKE1234567890123" },
  "production mode": { NODE_ENV: "production" },
  "live gateway": { HUSTLE_PAYMENT_GATEWAY: "paystack-live" },
  "production Supabase": { SUPABASE_SERVICE_ROLE_KEY: "never" },
  "production Paystack": { PAYSTACK_SECRET_KEY: "never" },
  "AWS credentials": { AWS_ACCESS_KEY_ID: "never" },
  "untrusted return": { PAYSTACK_TEST_RETURN_ORIGIN: "https://test.example" }
};
for (const [label, override] of Object.entries(denial)) {
  assert.throws(() => assertRealPaystackWebhookEnvironment({ ...env, ...override }),
    /^Error: REFUSED:/, label);
}
console.log("PASS: temporary test webhook approval denies " + Object.keys(denial).length +
  " unsafe environment modes, with no provider key or external network.");
