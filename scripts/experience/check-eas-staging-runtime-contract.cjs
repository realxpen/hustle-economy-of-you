#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { check } = require("./check-eas-staging-runtime.cjs");
const ref = "ab2cd3ef4gh5ij6kl7mn";
const env = {
  HUSTLE_STAGING_SUPABASE_REF: ref,
  APP_VARIANT: "preview",
  EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS: "false",
  EXPO_PUBLIC_API_URL: "https://staging-hustle-api.example.vercel.app/api/v1",
  EXPO_PUBLIC_SUPABASE_URL: "https://" + ref + ".supabase.co",
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_dummy"
};
assert.equal(check(env), true);
for (const patch of [
  { HUSTLE_STAGING_SUPABASE_REF: "pfgarmyygybmhiiuopym" },
  { HUSTLE_STAGING_SUPABASE_REF: "rtcjismwbrvulccryyau" },
  { APP_VARIANT: "production" }, { EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS: "true" },
  { EXPO_PUBLIC_API_URL: "https://api.example.vercel.app/api/v1" },
  { EXPO_PUBLIC_API_URL: "http://staging-hustle-api.example.vercel.app/api/v1" },
  { EXPO_PUBLIC_API_URL: "https://staging-hustle-api.example.vercel.app/payments" },
  { EXPO_PUBLIC_API_URL: "https://staging-hustle-api.example.vercel.app/api/v1?next=evil" },
  { EXPO_PUBLIC_SUPABASE_URL: "https://pfgarmyygybmhiiuopym.supabase.co" },
  { EXPO_PUBLIC_SUPABASE_URL: "https://" + ref + ".supabase.co.evil.test" },
  { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_unsafe" },
  { EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" }
]) assert.throws(() => check({ ...env, ...patch }), /STAGING_PREVIEW_CONFIGURATION_INVALID/);
const workflow = fs.readFileSync(".github/workflows/hustle-mobile-eas-preview.yml", "utf8");
assert.match(workflow, /check-eas-staging-runtime\.cjs/);
assert.match(workflow, /eas env:pull --environment preview/);
assert.match(workflow, /HUSTLE_STAGING_SUPABASE_REF/);
assert.ok(workflow.indexOf("check-eas-staging-runtime.cjs") < workflow.indexOf("Queue EAS cloud preview"));
assert.doesNotMatch(workflow, /eas submit|--auto-submit/);
console.log("PASS: cloud EAS preview refuses production Auth/API, unsafe URL and booking writes");
