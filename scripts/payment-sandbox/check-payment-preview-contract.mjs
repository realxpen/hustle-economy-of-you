import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { validateApiRuntimeEnvironment, chooseHustleAuthPort } =
  require("../../apps/api/dist/auth/staging-auth-selection.js");
const { paymentPreviewRequestAllowed } =
  require("../../apps/api/dist/payment/payment-preview-request-policy.js");

const host = "ep-payment-preview-ux042.c-2.eu-west-2.aws.neon.tech";
const apiOrigin = "https://hustle-payment-preview-api.realxpens.workers.dev";
const webOrigin = "https://hustle-payment-preview.realxpens.workers.dev";
const dsn = schema => `postgresql://hustle_payment_preview_api:long-test-only-password-1234@${host}/hustle_payment_preview?sslmode=require&schema=${schema}`;
const valid = {
  HUSTLE_RUNTIME_SCOPE: "payment-preview",
  HUSTLE_PAYMENT_PREVIEW_APPROVAL: "I_AUTHORIZE_SEPARATE_TEST_PREVIEW_ONLY",
  NODE_ENV: "production",
  HUSTLE_AUTH_PROVIDER: "expo-better-auth",
  HUSTLE_PAYMENT_GATEWAY: "paystack-test",
  HUSTLE_FINANCIAL_PROVIDERS_ENABLED: "test-only",
  HUSTLE_PAYMENT_PREVIEW_DB_HOST: host,
  HUSTLE_PAYMENT_PREVIEW_PROJECT_ID: "preview-project-ux042",
  HUSTLE_PAYMENT_PREVIEW_BRANCH_ID: "br-preview-testing-ux042",
  DATABASE_URL: dsn("public"),
  STAGING_AUTH_DATABASE_URL: dsn("payment_auth"),
  HUSTLE_PAYMENT_PREVIEW_API_ORIGIN: apiOrigin,
  HUSTLE_PAYMENT_PREVIEW_WEB_ORIGIN: webOrigin,
  WEB_ORIGIN: webOrigin,
  BETTER_AUTH_URL: apiOrigin + "/api/auth",
  PAYSTACK_TEST_RETURN_ORIGIN: webOrigin,
  BETTER_AUTH_SECRET: "offline-only-nonproduction-session-secret-xyz",
  PAYSTACK_TEST_SECRET_KEY: "sk_test_OFFLINEONLY1234567890",
  HUSTLE_STAGING_TEST_EMAILS: "buyer@example.test,seller@example.test"
};

assert.equal(validateApiRuntimeEnvironment({ ...valid }), "payment-preview");
// AWS automatically injects these temporary role credentials into Lambda.
// The test-only preview must allow ONLY its specific function identity.
assert.equal(validateApiRuntimeEnvironment({ ...valid,
  AWS_ACCESS_KEY_ID: "TEMPORARY_EXECUTION_ROLE_KEY",
  AWS_SECRET_ACCESS_KEY: "TEMPORARY_EXECUTION_ROLE_SECRET",
  AWS_SESSION_TOKEN: "TEMPORARY_EXECUTION_ROLE_TOKEN",
  AWS_LAMBDA_FUNCTION_NAME: "hustle-payment-preview-api",
  AWS_REGION: "eu-west-2"
}), "payment-preview");
const supabase = { verifyAccessToken: () => { throw Error("Do not use production"); } };
assert.notEqual(chooseHustleAuthPort(supabase, valid), supabase,
  "Preview authentication must use a separate invited Better Auth port");
assert.equal(validateApiRuntimeEnvironment({}), "production");
assert.equal(chooseHustleAuthPort(supabase, {}), supabase);

const deny = {
  "missing approval": { HUSTLE_PAYMENT_PREVIEW_APPROVAL: "" },
  "production scope": { HUSTLE_RUNTIME_SCOPE: "production" },
  "staging scope": { HUSTLE_RUNTIME_SCOPE: "isolated-staging" },
  "wrong node env": { NODE_ENV: "development" },
  "live payment gateway": { HUSTLE_PAYMENT_GATEWAY: "paystack-live" },
  "sandbox payment gateway": { HUSTLE_PAYMENT_GATEWAY: "sandbox" },
  "wrong finance activation": { HUSTLE_FINANCIAL_PROVIDERS_ENABLED: "true" },
  "live Paystack key": { PAYSTACK_TEST_SECRET_KEY: "sk_live_NOT_ALLOWED1234567" },
  "missing Paystack key": { PAYSTACK_TEST_SECRET_KEY: "" },
  "production Paystack key": { PAYSTACK_SECRET_KEY: "secret" },
  "production Supabase": { SUPABASE_SERVICE_ROLE_KEY: "secret" },
  "staging child branch": { HUSTLE_STAGING_BRANCH_ID: "br-dark-sunset-zay33p1s" },
  "existing staging host": { HUSTLE_PAYMENT_PREVIEW_DB_HOST: "ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech" },
  "staging project": { HUSTLE_PAYMENT_PREVIEW_PROJECT_ID: "summer-sound-54525078" },
  "staging branch": { HUSTLE_PAYMENT_PREVIEW_BRANCH_ID: "br-dark-sunset-zay33p1s" },
  "wrong database name": { DATABASE_URL: dsn("public").replace("/hustle_payment_preview?", "/hustle_staging?") },
  "production db user": { DATABASE_URL: dsn("public").replace("hustle_payment_preview_api:", "postgres:") },
  "wrong db schema": { DATABASE_URL: dsn("payment_auth") },
  "wrong auth db schema": { STAGING_AUTH_DATABASE_URL: dsn("public") },
  "missing TLS": { DATABASE_URL: dsn("public").replace("sslmode=require", "sslmode=disable") },
  "wrong db host": { DATABASE_URL: dsn("public").replace(host, "prod.example.com") },
  "wrong preview domain": { WEB_ORIGIN: "https://hustle-ios-pwa-staging.realxpens.workers.dev" },
  "wrong callback origin": { PAYSTACK_TEST_RETURN_ORIGIN: "https://checkout.example.com" },
  "wrong auth origin": { BETTER_AUTH_URL: "https://hustle-isolated-staging-api.vercel.app/api/auth" },
  "unreviewed api host": { HUSTLE_PAYMENT_PREVIEW_API_ORIGIN: "https://attacker.example.com" },
  "weak auth secret": { BETTER_AUTH_SECRET: "short" },
  "empty invites": { HUSTLE_STAGING_TEST_EMAILS: "" },
  "non-invited bad address": { HUSTLE_STAGING_TEST_EMAILS: "buyer" },
  "arbitrary extra ssl param": { DATABASE_URL: dsn("public") + "&connect_timeout=20" },
  "unapproved AWS credential": { AWS_ACCESS_KEY_ID: "secret" },
  "wrong Lambda name with AWS credentials": {
    AWS_ACCESS_KEY_ID: "temporary", AWS_SECRET_ACCESS_KEY: "temporary",
    AWS_SESSION_TOKEN: "temporary", AWS_REGION: "eu-west-2",
    AWS_LAMBDA_FUNCTION_NAME: "hustle-isolated-lambda-staging"
  },
  "wrong Lambda region with AWS credentials": {
    AWS_ACCESS_KEY_ID: "temporary", AWS_SECRET_ACCESS_KEY: "temporary",
    AWS_SESSION_TOKEN: "temporary", AWS_REGION: "us-east-1",
    AWS_LAMBDA_FUNCTION_NAME: "hustle-payment-preview-api"
  },
  "incomplete Lambda credentials": {
    AWS_ACCESS_KEY_ID: "temporary", AWS_SECRET_ACCESS_KEY: "temporary",
    AWS_LAMBDA_FUNCTION_NAME: "hustle-payment-preview-api", AWS_REGION: "eu-west-2"
  }
};
for (const [name, patch] of Object.entries(deny)) {
  assert.throws(() => validateApiRuntimeEnvironment({ ...valid, ...patch }), undefined, name);
}

const allowed = [
  ["GET", "/api/v1/health"], ["GET", "/api/v1/cart"],
  ["GET", "/api/v1/orders/buyer"], ["GET", "/api/v1/orders/seller"],
  ["GET", "/api/v1/orders/ord_123456"], ["GET", "/api/v1/payments/pay_123456"],
  ["GET", "/api/v1/payments/subjects/BOOKING/booking_1234/latest"],
  ["POST", "/api/v1/cart/items"], ["POST", "/api/v1/cart/checkout/preview"],
  ["POST", "/api/v1/cart/checkout"], ["POST", "/api/v1/bookings"],
  ["POST", "/api/v1/bookings/booking_1234/accept"],
  ["POST", "/api/v1/bookings/booking_1234/start"],
  ["POST", "/api/v1/bookings/booking_1234/complete"],
  ["POST", "/api/v1/payments/initialize"],
  ["POST", "/api/v1/payments/attempts/pay_1234/verify"],
  ["POST", "/api/v1/payments/webhooks/paystack"],
  ["POST", "/api/v1/wallet/escrows/bookings/booking_1234/release"],
  ["POST", "/api/v1/wallet/settlements/orders/order_1234/release"],
  ["POST", "/api/v1/orders/order_1234/process"],
  ["GET", "/api/auth/get-session"], ["POST", "/api/auth/sign-in/email"]
];
for(const [method,path] of allowed) assert.equal(paymentPreviewRequestAllowed(method,path),true, method+" "+path);
const forbidden = [
  ["POST", "/api/v1/sandbox/bookings/book_123/fund"],
  ["POST", "/api/v1/sandbox/wallet/withdrawals"],
  ["POST", "/api/v1/payments/webhooks/sandbox"],
  ["GET", "/api/v1/payments/webhooks/paystack"],
  ["POST", "/api/v1/payments/webhooks/unknown"],
  ["POST", "/api/v1/wallet/withdrawals"],
  ["POST", "/api/v1/wallet/refunds"],
  ["POST", "/api/v1/admin/users"],
  ["POST", "/api/v1/financial-operations/withdrawals"],
  ["POST", "/api/v1/payments/attempts/id/live"],
  ["POST", "/api/v1/payments/initialize%2fadmin"],
  ["POST", "/api/v1/payments//initialize"],
  ["POST", "/api/v1/payments/../initialize"],
  ["POST", "/api/v1/wallet/escrows/bookings/abc/refund"]
];
for(const [method,path] of forbidden) assert.equal(paymentPreviewRequestAllowed(method,path),false, method+" "+path);
console.log(`PASS: UX042 separate paid-preview auth/provider/db/issuer gates (${Object.keys(deny).length} denied) and ${allowed.length + forbidden.length} request-policy cases; no production credentials or network.`);
