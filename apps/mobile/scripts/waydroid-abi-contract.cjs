#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../../..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/hustle-mobile-native-gradle-diagnostic.yml"), "utf8");
const packaging = fs.readFileSync(path.join(root, "apps/mobile/scripts/package-staging-apk.cjs"), "utf8");
const stage = require("../eas.json").build["isolated-staging"];
assert.deepEqual(Object.keys(stage.env).sort(), [
  "APP_VARIANT", "EXPO_PUBLIC_HUSTLE_APP_VARIANT", "EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER",
  "EXPO_PUBLIC_HUSTLE_AUTH_URL", "EXPO_PUBLIC_HUSTLE_DEMO",
  "EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS", "EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES",
  "EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE"
].sort());
assert.equal(stage.env.EXPO_PUBLIC_HUSTLE_APP_VARIANT, "preview");
assert.equal(stage.env.EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE, "isolated-staging");
assert.equal(stage.env.EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER, "expo-better-auth");
assert.equal(stage.env.EXPO_PUBLIC_HUSTLE_DEMO, "false");
assert.equal(stage.env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS, "false");
assert.match(workflow, /abi: \[arm64-v8a, x86_64\]/);
assert.match(workflow, /-PreactNativeArchitectures=\$\{\{ matrix\.abi \}\}/);
assert.match(workflow, /BUILD_ARCH: \$\{\{ matrix\.abi \}\}/);
assert.match(workflow, /hustle-connected-staging-\$\{\{ matrix\.abi \}\}/);
assert.match(packaging, /"arm64-v8a", "x86_64"/);
assert.match(packaging, /"Hustle-Staging-Waydroid\.apk"/);
assert.match(packaging, /nativeLine\.includes/);
assert.match(packaging, /apksigner/);
assert.match(packaging, /assert\.match\(manifest, \/\^package/);
assert.match(packaging, /architectures: \[buildArch\]/);
assert.match(packaging, /sha256/);
assert.doesNotMatch(workflow, /eas build --platform|--auto-submit|secrets\.EXPO_TOKEN/);
console.log("PASS: isolated Android matrix preserves ARM phone and x86_64 Waydroid artifact identities and signature/ABI gates");
