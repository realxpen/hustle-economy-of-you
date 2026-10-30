#!/usr/bin/env node
"use strict";
// Executes the actual compiled TS guard and readiness probe against
// credential-free generated fixtures; never contacts the hosted server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(relative, mocks = {}) {
  const absolute = path.join(root, relative);
  const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    reportDiagnostics: true
  });
  assert.deepEqual(compiled.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error), []);
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = Module._nodeModulePaths(path.dirname(absolute));
  const original = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : original(name);
  mod._compile(compiled.outputText, absolute);
  return mod.exports;
}
const origin = "https://hustle-isolated-staging-api.vercel.app";
const expectedEnv = {
  APP_VARIANT: "preview",
  EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE: "isolated-staging",
  EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER: "expo-better-auth",
  EXPO_PUBLIC_HUSTLE_DEMO: "false",
  EXPO_PUBLIC_HUSTLE_AUTH_URL: origin + "/api/auth",
  EXPO_PUBLIC_API_URL: origin + "/api/v1",
  EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS: "false",
  EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES: "true"
};
const originalEnv = Object.fromEntries(Object.keys(expectedEnv).map(k => [k, process.env[k]]));
const manifest = { android: { package: "com.hustle.economyofyou.preview.staging" },
  ios: { bundleIdentifier: "com.hustle.economyofyou.preview.staging" } };
const platform = { OS: "android" };
const auth = load("src/lib/staging-auth.ts", {
  "better-auth/react": { createAuthClient: () => ({}) },
  "@better-auth/expo/client": { expoClient: () => ({}) },
  "expo-secure-store": {},
  "expo-constants": { __esModule: true, default: { expoConfig: manifest } },
  "react-native": { Platform: platform }
});
const { checkStagingApiReady } = load("src/lib/staging-connectivity.ts");
const stageScreen = fs.readFileSync(path.join(root, "src/experience/StagingSignIn.tsx"), "utf8");
const expectedHealth = { service: "hustle-api", scope: "isolated-staging", status: "ok",
  dependencies: { database: "connected", auth: "connected" } };
const reply = (health = expectedHealth, status = 200, contentType = "application/json") => ({
  status, headers: { get: name => name === "content-type" ? contentType : null },
  json: async () => health
});
const tests = [];
async function check(label, fn) { await fn(); tests.push(label); console.log("PASS: " + label); }
(async () => {
  try {
    Object.assign(process.env, expectedEnv);
    await check("Exact internal preview and staging auth configuration passes", () => {
      assert.equal(auth.isExpoStagingSelected(), true);
      assert.doesNotThrow(() => auth.validateExpoStagingConfiguration());
    });
    await check("Embedded preview identity AND runtime scope required; production/demo fail closed", () => {
      for (const os of ["android", "ios"]) {
        platform.OS = os;
        const identity = os === "android" ? manifest.android : manifest.ios;
        const field = os === "android" ? "package" : "bundleIdentifier";
        const original = identity[field];
        identity[field] = "com.hustle.economyofyou";
        assert.throws(() => auth.validateExpoStagingConfiguration(), /isolated/i);
        identity[field] = original;
        assert.doesNotThrow(() => auth.validateExpoStagingConfiguration());
      }
      platform.OS = "android";
      for (const [name, bad] of [
        ["EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER", "supabase"],
        ["EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE", "production"],
        ["EXPO_PUBLIC_HUSTLE_DEMO", "true"],
        ["EXPO_PUBLIC_HUSTLE_AUTH_URL", "https://untrusted.invalid/api/auth"],
        ["EXPO_PUBLIC_API_URL", "https://untrusted.invalid/api/v1"],
        ["EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS", "true"],
        ["EXPO_PUBLIC_HUSTLE_ENABLE_ENQUIRY_MESSAGES", "false"]
      ]) {
        const previous = process.env[name];
        process.env[name] = bad;
        assert.throws(() => auth.validateExpoStagingConfiguration(), /isolated|configured/i, name + " must be rejected");
        process.env[name] = previous;
      }
    });
    await check("Public health probe uses strict origin, anonymous GET and no cookie/token", async () => {
      const ok = await checkStagingApiReady(async (url, opts) => {
        assert.equal(url, origin + "/api/v1/health");
        assert.equal(opts.method, "GET");
        assert.equal(opts.credentials, "omit");
        assert.equal(opts.redirect, "manual");
        assert.equal(opts.cache, "no-store");
        assert.deepEqual(opts.headers, { accept: "application/json" });
        assert.equal(typeof opts.signal.aborted, "boolean");
        assert.equal(Object.hasOwn(opts.headers, "authorization"), false);
        return reply();
      });
      assert.equal(ok, true);
    });
    await check("Cross-environment, degraded, malformed, redirected and HTML health refused", async () => {
      for (const body of [
        { ...expectedHealth, scope: "production" },
        { ...expectedHealth, dependencies: { database: "unavailable", auth: "connected" } },
        { ...expectedHealth, dependencies: { database: "connected", auth: "not_configured" } },
        { ...expectedHealth, service: "other" },
        { ...expectedHealth, status: "degraded" },
        null
      ]) assert.equal(await checkStagingApiReady(async () => reply(body)), false);
      assert.equal(await checkStagingApiReady(async () => reply(expectedHealth, 302)), false);
      assert.equal(await checkStagingApiReady(async () => reply(expectedHealth, 200, "text/html")), false);
      assert.equal(await checkStagingApiReady(async () => { throw new Error("offline"); }), false);
    });
    await check("Stalled public health times out instead of freezing sign-in", async () => {
      const start = Date.now();
      const result = await checkStagingApiReady((_url, opts) => new Promise((_resolve, reject) => {
        opts.signal.addEventListener("abort", () => reject(new Error("abort")), { once: true });
      }), 5);
      assert.equal(result, false);
      assert.ok(Date.now() - start < 1000);
    });
    await check("Native screen shows connectivity retry and verifies session before entry", () => {
      assert.match(stageScreen, /checkStagingApiReady\(\)/);
      assert.match(stageScreen, /Retry test server connection/);
      assert.match(stageScreen, /serverStatus === "unavailable"/);
      assert.match(stageScreen, /confirmed\.error \|\| !confirmed\.data\?\.session \|\| !confirmed\.data\?\.user/);
      assert.match(stageScreen, /<MobileExperience/);
      assert.doesNotMatch(stageScreen, /DATABASE_URL|BETTER_AUTH_SECRET|SUPABASE_SERVICE_ROLE_KEY/);
    });
    console.log("PASS: " + tests.length + " staging device-readiness contracts; no live calls or real identities");
  } finally {
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
