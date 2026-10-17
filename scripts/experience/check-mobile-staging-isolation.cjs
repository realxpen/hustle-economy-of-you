#!/usr/bin/env node
// Offline source+behavior contract. Safe fixtures only; never contacts Supabase or Vercel.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync("apps/api/src/common/staging-isolation.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, URL, Set });
const { assertStagingApiIsolation, stagingMutationBlocked } = moduleExports;
assert.equal(typeof assertStagingApiIsolation, "function");
assert.equal(typeof stagingMutationBlocked, "function");
const ref = "ab2cd3ef4gh5ij6kl7mn";
const good = {
  HUSTLE_DEPLOY_ENV: "staging",
  HUSTLE_STAGING_SUPABASE_REF: ref,
  SUPABASE_URL: "https://" + ref + ".supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
  DATABASE_URL: "postgresql://postgres:fixture@db." + ref + ".supabase.co:5432/postgres?sslmode=require"
};
assert.doesNotThrow(() => assertStagingApiIsolation(good));
assert.doesNotThrow(() => assertStagingApiIsolation({
  ...good, DATABASE_URL: "postgresql://postgres." + ref + ":fixture@aws-0-eu-west-1.pooler.supabase.com:6543/postgres"
}));
const rejected = [
  { HUSTLE_STAGING_SUPABASE_REF: "pfgarmyygybmhiiuopym" },
  { HUSTLE_STAGING_SUPABASE_REF: "rtcjismwbrvulccryyau" },
  { HUSTLE_STAGING_SUPABASE_REF: "vkedlbnvehgfenmwgqrw" },
  { HUSTLE_STAGING_SUPABASE_REF: "" },
  { SUPABASE_URL: "https://pfgarmyygybmhiiuopym.supabase.co" },
  { SUPABASE_URL: "http://" + ref + ".supabase.co" },
  { SUPABASE_URL: "https://" + ref + ".supabase.co.attacker.example" },
  { DATABASE_URL: "postgresql://postgres:fixture@db.pfgarmyygybmhiiuopym.supabase.co/postgres" },
  { DATABASE_URL: "postgresql://postgres.pfgarmyygybmhiiuopym:fixture@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" },
  { DATABASE_URL: "postgresql://postgres.otherstage:fixture@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" },
  { DATABASE_URL: "" },
  { SUPABASE_PUBLISHABLE_KEY: "" },
  { SUPABASE_PUBLISHABLE_KEY: "sb_secret_forbidden" }
];
for (const patch of rejected) {
  assert.throws(() => assertStagingApiIsolation({ ...good, ...patch }), /STAGING_ISOLATION_FAILED/,
    "Stage must fail closed: " + Object.keys(patch).join(","));
}
for (const route of [
  "/api/v1/payments/initialize", "/api/v1/payments/webhooks/sandbox",
  "/api/v1/wallet", "/api/v1/cart/checkout", "/api/v1/orders/foo/ship",
  "/api/v1/bookings", "/api/v1/bookings/foo/accept",
  "/api/v1/financial-operations/foo", "/api/v1/moniflow/receipts"
]) assert.equal(stagingMutationBlocked(good, "POST", route), true, "Blocked: " + route);
for (const route of ["/api/v1/auth/sync", "/api/v1/posts/foo/comments",
  "/api/v1/posts/foo/like", "/api/v1/search", "/api/v1/feed/for-you"])
  assert.equal(stagingMutationBlocked(good, "POST", route), false, "Allowed: " + route);
assert.equal(stagingMutationBlocked(good, "GET", "/api/v1/bookings/slots"), false);
assert.equal(stagingMutationBlocked({...good, HUSTLE_DEPLOY_ENV: "production"}, "POST", "/api/v1/bookings"), false);
const serverless = fs.readFileSync("apps/api/api/index.ts", "utf8");
const standalone = fs.readFileSync("apps/api/src/main.ts", "utf8");
for (const s of [serverless, standalone]) {
  assert.match(s, /assertStagingApiIsolation\(process\.env\)/);
  assert.match(s, /stagingMutationBlocked\(process\.env,/);
  assert.match(s, /STAGING_MUTATION_DISABLED/);
}
console.log("PASS: isolated Supabase refs, DB/URL identity and no financial/booking writes in staging");
