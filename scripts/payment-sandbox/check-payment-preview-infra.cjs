const assert = require("node:assert/strict");
const fs = require("node:fs");

const template = fs.readFileSync("infra/aws/lambda/payment-preview-template.yaml", "utf8");
const workflow = fs.readFileSync(".github/workflows/hustle-payment-preview-api-deploy.yml", "utf8");
const worker = fs.readFileSync("infra/cloudflare/payment-preview-api-worker.mjs","utf8");

// These are repository security contracts for release intent; the real provider,
// AWS and Neon acceptance is protected and manual. Do not read secrets here.
for(const text of [
 "hustle-payment-preview-api",
 "hustle-payment-preview-lambda-execution",
 "hustle-payment-preview-[A-Za-z0-9_-]+",
 "HUSTLE_RUNTIME_SCOPE: payment-preview",
 "HUSTLE_PAYMENT_GATEWAY: paystack-test",
 "HUSTLE_FINANCIAL_PROVIDERS_ENABLED: test-only",
 "HUSTLE_PAYMENT_PREVIEW_APPROVAL: I_AUTHORIZE_SEPARATE_TEST_PREVIEW_ONLY",
 "HUSTLE_PAYMENT_PREVIEW_PROJECT_ID: !Ref PreviewNeonProjectId",
 "HUSTLE_PAYMENT_PREVIEW_BRANCH_ID: !Ref PreviewNeonBranchId",
 "PAYSTACK_TEST_RETURN_ORIGIN: https://hustle-payment-preview.realxpens.workers.dev",
 "PAYSTACK_TEST_SECRET_KEY: !Sub",
 "STAGING_AUTH_DATABASE_URL: !Sub",
 "DATABASE_URL: !Sub",
 "BETTER_AUTH_SECRET: !Sub",
 "AuthType: NONE"
]) assert.ok(template.includes(text), "Missing isolated template boundary: "+text);
assert.doesNotMatch(template,/hustle-isolated-lambda-staging|hustle-isolated-staging-credentials|hustle-ios-pwa-staging/);
assert.doesNotMatch(template,/SUPABASE_SERVICE_ROLE|PAYSTACK_SECRET_KEY|sk_live_/);
assert.match(template,/ImageUri:[\s\S]*?AllowedPattern: '\^707859598737/);
assert.match(template,/AWS_LWA_PORT: '8080'/);
assert.match(template,/AWS_LWA_READINESS_CHECK_PATH: \/api\/v1\/health/);

for(const text of [
 "workflow_dispatch:",
 "I_AUTHORIZE_NEW_PAYMENT_PREVIEW_API_ONLY",
 "hustle-payment-preview-api",
 "hustle-github-payment-preview-deployer",
 "environment: hustle-payment-preview-api",
 "github.ref == 'refs/heads/main'",
 "github.repository == 'realxpen/hustle-economy-of-you'",
 "NEON_PROJECT_ID",
 "NEON_BRANCH_ID",
 "NEON_HOST",
 "NEON_PROJECT_ID\" != 'summer-sound-54525078'",
 "aws cloudformation validate-template",
 "aws cloudformation deploy",
 "node scripts/payment-sandbox/check-payment-preview-api-edge.mjs",
 "wrangler deploy",
 "test \"$DENIED\" = 401",
 "test \"$WEBHOOK_GET\" = 403",
 "configured-test-only",
 "Dedicated payment preview secret is INACTIVE"
]) assert.ok(workflow.includes(text), "Missing protected deployment policy: "+text);
assert.doesNotMatch(workflow,/^  push:|^  pull_request:|^  schedule:/m);
assert.doesNotMatch(workflow,/hustle-isolated-lambda-staging|hustle-isolated-staging-api@sha256/);
assert.doesNotMatch(workflow,/ecr-public get-login-password/);

assert.match(worker,/PREVIEW_UPSTREAM_ORIGIN/);
assert.match(worker,/headers = new Headers\(request.headers\)/);
console.log("PASS: isolated AWS preview stack, immutable image, dedicated identity, manual-only guarded release and separate Cloudflare edge; no deployment.");
