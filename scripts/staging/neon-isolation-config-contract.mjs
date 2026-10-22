#!/usr/bin/env node
import assert from "node:assert/strict";
import { STAGING_IDENTITY, validateIsolatedStagingConfiguration }
  from "../../infra/neon/staging/stagingConfig.mjs";

const good = Object.freeze({
  HUSTLE_RUNTIME_SCOPE: "isolated-staging",
  HUSTLE_AUTH_PROVIDER: "neon-managed",
  HUSTLE_STAGING_PROJECT_ID: STAGING_IDENTITY.projectId,
  NEON_AUTH_BASE_URL: STAGING_IDENTITY.authBaseUrl,
  NEON_AUTH_JWKS_URL: STAGING_IDENTITY.jwksUrl,
  EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS: "false",
  HUSTLE_FINANCIAL_PROVIDERS_ENABLED: "false",
  DATABASE_URL: "postgresql://ci_user:example-only-DO-NOT-USE@" +
    STAGING_IDENTITY.databaseHosts[0] + "/hustle_staging?sslmode=require"
});
assert.deepEqual(validateIsolatedStagingConfiguration(good),{
  scope:"isolated-staging", projectId:STAGING_IDENTITY.projectId
});
for (const [key,value] of [
  ["HUSTLE_RUNTIME_SCOPE","production"],
  ["HUSTLE_AUTH_PROVIDER","supabase"],
  ["HUSTLE_STAGING_PROJECT_ID","some-other-project"],
  ["NEON_AUTH_BASE_URL","https://wrong.example/auth"],
  ["NEON_AUTH_JWKS_URL","https://wrong.example/jwks"],
  ["EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS","true"],
  ["HUSTLE_FINANCIAL_PROVIDERS_ENABLED","true"],
  ["SUPABASE_URL","https://example.supabase.co"],
  ["SUPABASE_PUBLISHABLE_KEY","unsafe"],
  ["SUPABASE_SERVICE_ROLE_KEY","unsafe"],
  ["PAYSTACK_SECRET_KEY","unsafe"],
  ["DATABASE_URL","postgresql://postgres:never@127.0.0.1/production?sslmode=require"],
  ["DATABASE_URL","postgresql://ci_user:never@"+
    STAGING_IDENTITY.databaseHosts[0]+"/hustle_staging"],
  ["DATABASE_URL","postgresql://ci_user:never@"+
    STAGING_IDENTITY.databaseHosts[0]+"/real_hustle?sslmode=require"],
  ["DATABASE_URL","postgresql://ci_user:never@"+
    STAGING_IDENTITY.databaseHosts[0]+".attacker.invalid/hustle_staging?sslmode=require"]
]) {
  assert.throws(()=>validateIsolatedStagingConfiguration({...good,[key]:value}),
    /staging|provider|Wrong|unsafe|forbidden|disabled/i,key);
}
for (const key of ["HUSTLE_STAGING_PROJECT_ID","DATABASE_URL","NEON_AUTH_BASE_URL"]) {
  const copy={...good};delete copy[key];
  assert.throws(()=>validateIsolatedStagingConfiguration(copy),Error,key);
}
assert.ok(STAGING_IDENTITY.jwksUrl.startsWith(STAGING_IDENTITY.authBaseUrl+"/"));
console.log("PASS: exact-isolation guard pins new Neon Auth and database, rejects any production or payment fallback");
