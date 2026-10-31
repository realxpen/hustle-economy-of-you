import assert from "node:assert/strict";
import { validatePreviewSecret } from "./check-aws-secret-readiness.mjs";
const HOST="ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech";
const base="postgresql://hustle_payment_preview_api:FAKEONLYLOCALTESTPASS12345@"+HOST+"/hustle_payment_preview?sslmode=require&schema=";
const valid={
  DATABASE_URL:base+"public",
  STAGING_AUTH_DATABASE_URL:base+"payment_auth",
  BETTER_AUTH_SECRET:"TEST_ONLY_".repeat(5),
  HUSTLE_STAGING_TEST_EMAILS:"buyer@example.test,seller@example.test",
  PAYSTACK_TEST_SECRET_KEY:"sk_test_FAKEOFFLINEONLY1234567890"
};
const good=validatePreviewSecret(valid);
assert.equal(good.invitedTestAccountCount,2);
assert.equal(good.gateway,"paystack-test");
for (const [reason, patch] of [
  [/secret keys/, {RANDOM_EXTRA:"fake"}],
  [/public DB URL/, {DATABASE_URL:valid.DATABASE_URL.replace(HOST,"ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech")}],
  [/public DB URL/, {DATABASE_URL:valid.DATABASE_URL.replace(HOST,"ep-holy-block-zauxat1w-pooler.c-2.eu-west-2.aws.neon.tech")}],
  [/public DB URL/, {DATABASE_URL:valid.DATABASE_URL.replace("hustle_payment_preview_api","hustle_payment_preview_owner")}],
  [/public DB URL/, {DATABASE_URL:valid.DATABASE_URL.replace("sslmode=require","sslmode=disable")}],
  [/public DB URL/, {DATABASE_URL:valid.DATABASE_URL+"&channel_binding=require"}],
  [/public DB URL/, {DATABASE_URL:valid.DATABASE_URL+"&schema=public"}],
  [/payment_auth DB URL/, {STAGING_AUTH_DATABASE_URL:valid.STAGING_AUTH_DATABASE_URL.replace("schema=payment_auth","schema=public")}],
  [/differ/, {STAGING_AUTH_DATABASE_URL:valid.STAGING_AUTH_DATABASE_URL.replace("FAKEONLYLOCALTESTPASS12345","ANOTHERLOCALTESTPASSWORD12345")}],
  [/Auth secret/, {BETTER_AUTH_SECRET:"NOT_CONFIGURED"}],
  [/TEST-only/, {PAYSTACK_TEST_SECRET_KEY:"not_a_test_provider_key"}],
  [/TEST-only/, {PAYSTACK_TEST_SECRET_KEY:"NOT_CONFIGURED"}],
  [/email/, {HUSTLE_STAGING_TEST_EMAILS:""}],
  [/email/, {HUSTLE_STAGING_TEST_EMAILS:"buyer@example.test,buyer@example.test"}],
]) {
  assert.throws(()=>validatePreviewSecret({...valid,...patch}),reason,"bad credential fixture was accepted");
}
console.log("PASS: exact private Neon runtime/auth URLs, separate Better Auth, TEST-only key and invited users enforced offline; no AWS, provider or Neon access.");
