#!/usr/bin/env node
"use strict";
// Preflight an Expo/EAS *preview* before using an Android/iOS free build credit.
// This script never fetches endpoints, prints keys, or submits a transaction.
function fail() { throw new Error("STAGING_PREVIEW_CONFIGURATION_INVALID: require isolated stage API, Supabase and disabled booking writes"); }
const excluded = new Set([
  "pfgarmyygybmhiiuopym", // Hustle production
  "rtcjismwbrvulccryyau", // MONIFlow
  "vkedlbnvehgfenmwgqrw"  // Personal OS
]);
function check(config) {
  const ref = config.HUSTLE_STAGING_SUPABASE_REF?.trim();
  if (!ref || !/^[a-z0-9]{20}$/.test(ref) || excluded.has(ref)) fail();
  if (config.APP_VARIANT !== "preview" || config.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== "false") fail();
  if (!config.EXPO_PUBLIC_SUPABASE_URL || !config.EXPO_PUBLIC_API_URL || !config.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY) fail();
  if (config.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_secret_")) fail();
  try {
    const auth = new URL(config.EXPO_PUBLIC_SUPABASE_URL);
    const api = new URL(config.EXPO_PUBLIC_API_URL);
    if (auth.protocol !== "https:" || auth.hostname !== ref + ".supabase.co"
        || auth.pathname !== "/" || auth.username || auth.password || auth.port
        || auth.search || auth.hash) fail();
    if (api.protocol !== "https:" || api.pathname !== "/api/v1" || api.port
        || api.username || api.password || api.search || api.hash
        || !/(^|[.-])(staging|stage|qa)([.-]|$)/.test(api.hostname)
        || api.hostname.endsWith(".supabase.co")) fail();
  } catch { fail(); }
  return true;
}
module.exports = { check };
if (require.main === module) {
  const file = process.env.HUSTLE_EAS_PREVIEW_ENV_FILE;
  if (!file || !process.loadEnvFile) fail();
  process.loadEnvFile(file); // File exists only in the ephemeral GitHub runner.
  check(process.env);
  console.log("PASS: EAS preview targets isolated staging API and Auth; booking writes disabled");
}
