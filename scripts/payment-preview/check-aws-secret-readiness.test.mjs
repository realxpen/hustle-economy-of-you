import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { validateSecret } from "./check-aws-secret-readiness.mjs";
const PASSWORD="FAKE_ONLY_TEST_PASSWORD_123456789";
const HOST="ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech";
const base=`postgresql://hustle_payment_preview_api:${PASSWORD}@${HOST}/hustle_payment_preview?sslmode=require&schema=`;
const good={
  DATABASE_URL:base+"public",
  STAGING_AUTH_DATABASE_URL:base+"payment_auth",
  BETTER_AUTH_SECRET:"THIS_IS_FAKE_ONLY_SECRET_".repeat(3),
  HUSTLE_STAGING_TEST_EMAILS:"buyer@example.test,seller@example.test",
  PAYSTACK_TEST_SECRET_KEY:"sk_test_FAKEONLY1234567890"
};
assert.equal(validateSecret(good).ready,true);
const cases=[
  ["not a postgres URL",{DATABASE_URL:"this is not a connection string"}],
  ["wrong database",{DATABASE_URL:good.DATABASE_URL.replace("/hustle_payment_preview?","/not_the_preview?")}],
  ["staging host",{DATABASE_URL:good.DATABASE_URL.replace(HOST,"ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech")}],
  ["pooled host",{DATABASE_URL:good.DATABASE_URL.replace("zauxat1w.","zauxat1w-pooler.")}],
  ["wrong runtime role",{DATABASE_URL:good.DATABASE_URL.replace("hustle_payment_preview_api","hustle_payment_preview_owner")}],
  ["TLS disabled",{DATABASE_URL:good.DATABASE_URL.replace("sslmode=require","sslmode=disable")}],
  ["bad public schema",{DATABASE_URL:good.DATABASE_URL.replace("schema=public","schema=payment_auth")}],
  ["auth schema wrong",{STAGING_AUTH_DATABASE_URL:good.DATABASE_URL}],
  ["different auth credential",{STAGING_AUTH_DATABASE_URL:good.STAGING_AUTH_DATABASE_URL.replace(PASSWORD,"OTHER_FAKE_TEST_PASSWORD_123456789")}],
  ["duplicate query",{DATABASE_URL:good.DATABASE_URL+"&schema=public"}],
  ["extra query",{DATABASE_URL:good.DATABASE_URL+"&user=postgres"}],
  ["live provider key",{PAYSTACK_TEST_SECRET_KEY:"sk_live_FAKEONLY1234567890"}],
  ["placeholder provider key",{PAYSTACK_TEST_SECRET_KEY:"NOT_CONFIGURED"}],
  ["missing better auth",{BETTER_AUTH_SECRET:"NOT_CONFIGURED"}],
  ["invalid test email",{HUSTLE_STAGING_TEST_EMAILS:"not-an-email"}],
  ["duplicate test email",{HUSTLE_STAGING_TEST_EMAILS:"buyer@example.test,buyer@example.test"}],
  ["missing field",null]
];
for(const [name,patch] of cases){
  let invalid=patch?{...good,...patch}:{...good};
  if(!patch)delete invalid.BETTER_AUTH_SECRET;
  assert.throws(()=>validateSecret(invalid),/REFUSED:/,name);
}
// Script accepts stdin and NEVER echoes the secret on success or failure.
const ok=spawnSync(process.execPath,["scripts/payment-preview/check-aws-secret-readiness.mjs"],
  {encoding:"utf8",input:JSON.stringify(good),timeout:4000});
assert.equal(ok.status,0,ok.stderr);
assert.match(ok.stdout,/PASS:/);
assert.ok(!ok.stdout.includes(PASSWORD));
assert.ok(!ok.stdout.includes(good.PAYSTACK_TEST_SECRET_KEY));
const bad=spawnSync(process.execPath,["scripts/payment-preview/check-aws-secret-readiness.mjs"],
  {encoding:"utf8",input:JSON.stringify({...good,DATABASE_URL:"SENSITIVE_FAKE_PASSWORD_DO_NOT_ECHO"}),timeout:4000});
assert.notEqual(bad.status,0);
assert.match(bad.stderr,/REFUSED: DATABASE_URL/);
assert.ok(!bad.stderr.includes("SENSITIVE_FAKE_PASSWORD_DO_NOT_ECHO"));
console.log("PASS: correct test-only secrets accepted; unsafe identity/TLS/roles/hosts/provider values rejected; output redacts secret values.");
