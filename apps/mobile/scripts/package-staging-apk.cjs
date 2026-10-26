"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const sourceSha = process.env.SOURCE_SHA;
const buildArch = process.env.BUILD_ARCH || "arm64-v8a";
assert.ok(["arm64-v8a", "x86_64"].includes(buildArch), "Unsupported Android ABI");
const apkName = buildArch === "x86_64" ? "Hustle-Staging-Waydroid.apk" : "Hustle-Staging.apk";
assert.match(sourceSha || "", /^[a-f0-9]{40}$/);
for (const [key, value] of Object.entries(require("../eas.json").build["isolated-staging"].env)) {
  assert.equal(process.env[key], value, "Connected build configuration mismatch: " + key);
}
const apk = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
const toolsRoot = path.join(process.env.ANDROID_HOME, "build-tools");
const version = fs.readdirSync(toolsRoot).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).reverse()
  .find(v => ["apksigner", "aapt"].every(tool => fs.existsSync(path.join(toolsRoot, v, tool))));
assert.ok(version, "Android signing and manifest tools must be installed");
execFileSync(path.join(toolsRoot, version, "apksigner"), ["verify", apk], { stdio: "inherit" });
const manifest = execFileSync(path.join(toolsRoot, version, "aapt"), ["dump", "badging", apk], { encoding: "utf8" });
assert.match(manifest, /^package: name='com\.hustle\.economyofyou\.preview\.staging'/m);
const nativeLine = manifest.split("\n").find(line => line.startsWith("native-code:")) || "";
assert.ok(nativeLine.includes("'" + buildArch + "'"), "APK must contain native libraries for " + buildArch);
const bytes = fs.readFileSync(apk);
const digest = createHash("sha256").update(bytes).digest("hex");
// Nothing is published until both actual SDK verification steps pass.
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, apkName), bytes);
fs.writeFileSync(path.join(output, apkName + ".sha256"), digest + "  " + apkName + "\n");
fs.writeFileSync(path.join(output, "build-info.json"), JSON.stringify({
  sourceSha, package: "com.hustle.economyofyou.preview.staging", architectures: [buildArch],
  authProvider: "expo-better-auth", api: "https://hustle-isolated-staging-api.vercel.app/api/v1",
  demo: false, bookingWrites: false, enquiryMessages: true,
  signing: "internal-test-debug-key", physicalDeviceTested: false
}, null, 2) + "\n");
console.log("PASS: actual APK signature, staging package, source metadata and SHA-256 verified");
