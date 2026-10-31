import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {normalizedPreviewRuntimeUrls,validatePreviewEmails} from "./configure-aws-secret.mjs";

const pooled="postgresql://hustle_payment_preview_api:FAKEONLYLONGPASSWORD1234@ep-holy-block-zauxat1w-pooler.c-2.eu-west-2.aws.neon.tech/hustle_payment_preview?sslmode=require&channel_binding=require";
const direct="postgresql://hustle_payment_preview_api:FAKEONLYLONGPASSWORD1234@ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech/hustle_payment_preview?sslmode=require";
for(const sample of [pooled,direct]) {
  const {app,auth}=normalizedPreviewRuntimeUrls(sample);
  assert.equal(new URL(app).hostname,"ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech");
  assert.equal(new URL(app).searchParams.get("schema"),"public");
  assert.equal(new URL(auth).searchParams.get("schema"),"payment_auth");
  assert.equal(new URL(app).searchParams.get("channel_binding"),null);
  assert.equal(new URL(app).searchParams.get("sslmode"),"require");
}
for(const wrong of [
  "",pooled.replace("hustle_payment_preview_api","hustle_payment_preview_owner"),
  pooled.replace("hustle_payment_preview?","neondb?"),
  pooled.replace("hustle_payment_preview?","hustle_staging?"),
  pooled.replace("zauxat1w","za8u3vsm"),
  pooled.replace("sslmode=require","sslmode=disable"),
  pooled.replace("FAKEONLYLONGPASSWORD1234","short"),
  pooled.replace("channel_binding=require","channel_binding=disable"),
  pooled+"&schema=public",
  pooled+"&user=postgres",
  "postgresql://hustle_payment_preview_api:FAKEONLYLONGPASSWORD1234@prod.example.com/hustle_payment_preview?sslmode=require"
]) assert.throws(()=>normalizedPreviewRuntimeUrls(wrong),/REFUSED/);
assert.equal(validatePreviewEmails(" Buyer@example.test, seller@example.test "),"buyer@example.test,seller@example.test");
for(const sample of ["","invalid","bad@@example.test","one@example.test,".repeat(11)])
  assert.throws(()=>validatePreviewEmails(sample),/REFUSED/);

const y=readFileSync(".github/workflows/hustle-payment-preview-secret-config.yml","utf8");
for(const v of ["workflow_dispatch:","hustle-payment-preview-api","I_AUTHORIZE_TEST_ONLY_SECRET_SETUP",
  "PREPARE_DATABASE_AND_AUTH","FINALIZE_TEST_ONLY","HUSTLE_PREVIEW_NEON_API_URL",
  "HUSTLE_PREVIEW_PAYSTACK_TEST_KEY","HUSTLE_PREVIEW_TEST_EMAILS",
  "scripts/payment-preview/configure-aws-secret.mjs"])
  assert.ok(y.includes(v),"Missing protected manual workflow setting: "+v);
assert.doesNotMatch(y,/^  (push|pull_request|schedule):/m);
assert.doesNotMatch(y,/wrangler deploy|cloudformation deploy|PAYSTACK_SECRET_KEY: \$\{\{/);

const code=readFileSync("scripts/payment-preview/configure-aws-secret.mjs","utf8");
assert.match(code,/PREVIEW_SECRET_PHASE|HUSTLE_PREVIEW_SECRET_PHASE/);
assert.match(code,/configured-test-only/);
assert.match(code,/NOT_CONFIGURED/);
assert.match(code,/psql/);
assert.match(code,/file:\/\//);
assert.doesNotMatch(code,/console\.log\(.*(?:env\.HUSTLE_PREVIEW_NEON_API_URL|env\.HUSTLE_PREVIEW_PAYSTACK_TEST_KEY)/);

for(const extra of [
  {},{GITHUB_REPOSITORY:"wrong/repo"},
  {GITHUB_REF:"refs/heads/other"},
  {HUSTLE_NEON_PROJECT_ID:"summer-sound-54525078"},
  {HUSTLE_NEON_BRANCH_ID:"br-dark-sunset-zay33p1s"},
  {HUSTLE_PREVIEW_SECRET_APPROVAL:"DO_NOT_CONFIGURE"}
]){
  const env={...process.env,GITHUB_REPOSITORY:"realxpen/hustle-economy-of-you",
    GITHUB_REF:"refs/heads/main",HUSTLE_NEON_PROJECT_ID:"fragrant-field-59689896",
    HUSTLE_NEON_BRANCH_ID:"br-curly-leaf-zat0ec8m",
    HUSTLE_PREVIEW_SECRET_APPROVAL:"I_AUTHORIZE_TEST_ONLY_SECRET_SETUP",
    HUSTLE_PREVIEW_SECRET_PHASE:"PREPARE_DATABASE_AND_AUTH",
    HUSTLE_PREVIEW_NEON_API_URL:"",...extra};
  const p=spawnSync(process.execPath,["scripts/payment-preview/configure-aws-secret.mjs"],
    {encoding:"utf8",timeout:4000,env});
  assert.notEqual(p.status,0);
  assert.match(p.stderr,/REFUSED/);
}
console.log("PASS: hosted Neon API URL and Paystack test-only secret gates deny unsafe config; no network, password, secret or AWS changes.");
