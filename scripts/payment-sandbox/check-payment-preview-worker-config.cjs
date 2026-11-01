// Offline executable contract for the actual Cloudflare config, not regex-only
// checks. No Cloudflare account, secrets, provider calls or deployment.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("apps/web/cloudflare.config.ts", "utf8");
const transformed = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
});
assert.equal(transformed.diagnostics?.length || 0, 0);
function config(env) {
  const module = { exports: {} };
  const binding = { assets: () => "assets", images: () => "images", text: v => v };
  vm.runInNewContext(transformed.outputText, {
    module, exports: module.exports,
    process: { env },
    require: n => {
      assert.equal(n, "cf/config");
      return { bindings: binding, defineConfig: v => v, defineWorker: v => v };
    }
  }, { timeout: 1500, filename: "cloudflare.config.js" });
  return module.exports.default.worker;
}
const defaultConfig = config({});
assert.equal(defaultConfig.name, "hustle-ios-pwa-staging");
assert.deepEqual(Array.from(defaultConfig.compatibilityFlags), ["nodejs_compat"]);
assert.equal(defaultConfig.compatibilityFlags.includes("global_fetch_strictly_public"), false);
assert.equal(defaultConfig.env.HUSTLE_ISOLATED_PWA_GATE, "isolated-staging");
assert.equal(defaultConfig.env.HUSTLE_API_BACKEND_TARGET, "vercel-isolated-staging");
assert.equal(defaultConfig.env.HUSTLE_PAYMENT_PREVIEW_API_ORIGIN, "");

const aws = config({ HUSTLE_AWS_PREVIEW_BUILD: "true" });
assert.equal(aws.name, "hustle-ios-pwa-aws-test");
assert.equal(aws.compatibilityFlags.includes("global_fetch_strictly_public"), false);
assert.equal(aws.env.HUSTLE_API_BACKEND_TARGET, "aws-lambda-isolated-staging");

const cutover = config({ HUSTLE_STAGING_AWS_CUTOVER_BUILD: "true" });
assert.equal(cutover.name, "hustle-ios-pwa-staging");
assert.equal(cutover.compatibilityFlags.includes("global_fetch_strictly_public"), false);
assert.equal(cutover.env.HUSTLE_API_BACKEND_TARGET, "aws-lambda-isolated-staging");

const exact = {
  HUSTLE_PAYMENT_PREVIEW_BUILD: "true",
  HUSTLE_API_BACKEND_TARGET: "payment-preview",
  HUSTLE_ISOLATED_PWA_GATE: "payment-preview",
  NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: "true"
};
const preview = config(exact);
assert.equal(preview.name, "hustle-payment-preview");
assert.deepEqual(Array.from(preview.compatibilityFlags), ["nodejs_compat", "global_fetch_strictly_public"]);
assert.equal(preview.env.HUSTLE_ISOLATED_PWA_GATE, "payment-preview");
assert.equal(preview.env.HUSTLE_API_BACKEND_TARGET, "payment-preview");
assert.equal(preview.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH, "true");
assert.equal(preview.env.HUSTLE_PAYMENT_PREVIEW_API_ORIGIN,
  "https://hustle-payment-preview-api.realxpens.workers.dev");
assert.equal(preview.env.NEXT_PUBLIC_HUSTLE_PAYMENT_PREVIEW, "true");
assert.equal(preview.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW, "false");

const forbidden = [
  { HUSTLE_PAYMENT_PREVIEW_BUILD: "false" },
  { HUSTLE_API_BACKEND_TARGET: "vercel-isolated-staging" },
  { HUSTLE_API_BACKEND_TARGET: "aws-lambda-isolated-staging" },
  { HUSTLE_ISOLATED_PWA_GATE: "isolated-staging" },
  { NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: "false" },
  { HUSTLE_AWS_PREVIEW_BUILD: "true" },
  { HUSTLE_STAGING_AWS_CUTOVER_BUILD: "true" }
];
for (const patch of forbidden) {
  assert.throws(() => config({ ...exact, ...patch }), undefined, JSON.stringify(patch));
}
assert.throws(() => config({ HUSTLE_AWS_PREVIEW_BUILD: "true",
  HUSTLE_STAGING_AWS_CUTOVER_BUILD: "true" }));
console.log("PASS: dedicated payment-preview Worker identity, exact API origin, default/preview/cutover separation, all 8 unsafe build combinations denied.");
