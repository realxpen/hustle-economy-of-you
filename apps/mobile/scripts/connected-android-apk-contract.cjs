#!/usr/bin/env node
"use strict";
// Credential-free acceptance gate for the internally distributed CONNECTED
// preview APK. Does not claim that the hosted server or a device was tested.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "../..");
const read = rel => fs.readFileSync(path.join(repoRoot, rel), "utf8");
const workflow = read(".github/workflows/hustle-mobile-native-gradle-diagnostic.yml");
const app = read("apps/mobile/App.tsx");
const auth = read("apps/mobile/src/lib/staging-auth.ts");
const signin = read("apps/mobile/src/experience/StagingSignIn.tsx");
const preview = require("../app.config.js")({ config: require("../app.json").expo });
const authHost = "https://hustle-isolated-staging-api.vercel.app";
const required = new Map([
  ["APP_VARIANT", "preview"],
  ["EXPO_PUBLIC_HUSTLE_DEMO", "false"],
  ["EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE", "isolated-staging"],
  ["EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER", "expo-better-auth"],
  ["EXPO_PUBLIC_HUSTLE_AUTH_URL", authHost + "/api/auth"],
  ["EXPO_PUBLIC_API_URL", authHost + "/api/v1"],
  ["EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS", "false"],
  ["EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES", "true"],
  ["HUSTLE_FINANCIAL_PROVIDERS_ENABLED", "false"]
]);
for (const [name, expected] of required) {
  assert.equal(process.env[name], expected, "Isolated connected APK env must be pinned: " + name);
  assert.ok(workflow.includes(name + ": " + (/^https:/.test(expected) ? expected : /^[a-z-]+$/.test(expected) && !["true","false"].includes(expected) ? expected : "'" + expected + "'")),
    "Native workflow must pin: " + name);
}
assert.equal(preview.name, "Hustle Preview");
assert.equal(preview.owner, "xpen");
assert.equal(preview.android.package, "com.hustle.economyofyou.preview");
assert.equal(preview.scheme, "hustle-preview");
assert.match(app, /if \(isExpoStagingSelected\(\)\) return <StagingSignIn \/>/);
assert.match(auth, /EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER === "expo-better-auth"/);
assert.match(auth, /getStagingAuth/);
assert.match(auth, /storage: SecureStore, disableCache: true/);
assert.match(signin, /auth\.signIn\.email/);
assert.match(signin, /auth\.signUp\.email/);
assert.match(signin, /auth\.signOut\(/);
assert.match(signin, /<MobileExperience/);
assert.match(workflow, /:app:assembleRelease/);
assert.match(workflow, /npx expo export --platform android/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /test -s "\$apk"/);
assert.match(workflow, /push:\s*\n\s*branches: \[main\]/);
assert.doesNotMatch(workflow, /\$\{\{\s*secrets\.|eas build|--auto-submit|eas submit|paystack|monnify/i,
  "Native internal build must not receive secrets or launch paid EAS/store/payment actions");
assert.ok(workflow.indexOf("node apps/mobile/scripts/connected-android-apk-contract.cjs") <
  workflow.indexOf(":app:assembleRelease"), "Fail before native build if staging controls change");
console.log("PASS: connected Android internal APK configured for isolated Better Auth, safe API host, guarded commerce and signed release packaging");
console.log("NOTE: hosted login, persisted sessions and device installation are unverified here");
