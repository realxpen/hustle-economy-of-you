#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
const demo = fs.readFileSync(path.resolve(__dirname, "../src/experience/DemoExperience.tsx"), "utf8");
const eas = require("../eas.json");
const workflow = fs.readFileSync(path.resolve(__dirname, "../../../.github/workflows/hustle-offline-android-demo.yml"), "utf8");
const packageJson = require("../package.json");
const entry = fs.readFileSync(path.resolve(__dirname, "../index.js"), "utf8");
assert.equal(packageJson.main, "index.js", "Use workspace-local Expo entry point; do not reference hoisted node_modules");
assert.match(entry, /registerRootComponent\(App\)/);
assert.match(entry, /from ['"]expo['"]/);
assert.match(entry, /from ['"]\.\/App['"]/);
const profile = eas.build.demo;
assert.ok(profile, "Require a separate Expo demo profile");
assert.equal(profile.environment, "development", "Keep demo outside potential production/stage EAS environments");
assert.equal(profile.distribution, "internal");
assert.equal(profile.android.buildType, "apk");
assert.equal(profile.env.APP_VARIANT, "preview");
assert.equal(profile.env.EXPO_PUBLIC_HUSTLE_DEMO, "true");
assert.equal(profile.env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS, "false");
assert.match(profile.env.EXPO_PUBLIC_API_URL, /^https:\/\/[-\w]+\.invalid\/api\/v1$/);
assert.match(profile.env.EXPO_PUBLIC_SUPABASE_URL, /^https:\/\/[-\w]+\.invalid$/);
assert.ok(profile.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_demo_"));
assert.match(app, /process\.env\.EXPO_PUBLIC_HUSTLE_DEMO === "true"/);
assert.ok(app.indexOf('if (demo) return <DemoExperience />;') < app.indexOf('if (session) return <MobileExperience'), "Demo must render before authenticated experience");
assert.match(app, /if \(demo \|\| !configured\) return;/);
for (const feature of [
  "FlatList", "pagingEnabled", "Comments", "Save to collection", "Share this work",
  "Creator", "Attached service", "Attached product", "Booking preview", "Explore",
  "Your collections", "Fictional", "DEMO", "Sample", "Sample offer only"
]) assert.ok(demo.toLowerCase().includes(feature.toLowerCase()), "Missing demo UI: " + feature);
for (const prohibited of [
  /\bfetch\s*\(/, /axios\./, /getSupabase/, /createClient\(/,
  /mobileApi\./, /\bDATABASE_URL\b/, /\bSUPABASE_SERVICE_ROLE_KEY\b/,
  /\bEAS_TOKEN\b/, /initializePayment\(/, /\bwallet\.credit\b/,
  /\/api\/v1\//, /https:\/\/(?!hustle-offline-demo\.invalid)/
]) assert.doesNotMatch(demo, prohibited, "No backend or real payment operations in offline demo UI");
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /approve_free_demo_build/);
assert.match(workflow, /eas build --platform android --profile demo --non-interactive --no-wait/);
assert.match(workflow, /node apps\/mobile\/scripts\/offline-demo-contract\.cjs/);
const rootPackage = require("../../../package.json");
assert.equal(rootPackage.overrides["expo-font"], "14.0.12");
assert.equal(rootPackage.overrides["@expo/vector-icons"], "15.0.3");
assert.equal(packageJson.dependencies["@expo/vector-icons"], "15.0.3");
assert.equal(packageJson.dependencies["expo-font"], "14.0.12");
assert.match(workflow, /node scripts\/check-native-autolinking\.cjs/);
assert.ok(workflow.indexOf("check-native-autolinking.cjs") < workflow.indexOf("eas build --platform android"), "Native version gate must precede all EAS builds");
assert.match(workflow, /npx expo export --platform android/);
assert.ok(workflow.indexOf("npx expo export --platform android") < workflow.indexOf("eas build --platform android"), "Metro preflight must happen before any EAS credit is consumed");
assert.doesNotMatch(workflow, /\n\s+(push|pull_request):|--auto-submit|eas submit|eas workflow:run/);
assert.ok(packageJson.dependencies["@expo/vector-icons"]);
console.log("PASS: offline demo uses fictitious local posts and disabled network/payment, with owner-gated Free APK queue");
