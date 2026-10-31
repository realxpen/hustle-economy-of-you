// Test the actual TypeScript web proxy's exported pure authorization helpers
// WITHOUT starting Next, making network calls, or deploying any Worker.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("apps/web/lib/api/isolated-web-proxy.ts", "utf8");
assert.equal((source.match(/import \{ NextRequest, NextResponse \}/g) || []).length, 1,
  "Never duplicate Next proxy source");
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022
} });
assert.equal(compiled.diagnostics?.length ?? 0, 0, "Source must transpile");

function load(env) {
  const m = { exports: {} };
  const stub = { NextResponse: { json: () => ({}) }, NextRequest: class {} };
  vm.runInNewContext(compiled.outputText, {
    module: m, exports: m.exports, process: { env },
    require: name => name === "next/server" ? stub : require(name),
    URL, Headers, console
  }, { filename: "isolated-web-proxy.js", timeout: 1000 });
  return m.exports;
}

const staged = load({
  HUSTLE_ISOLATED_PWA_GATE: "isolated-staging",
  HUSTLE_API_BACKEND_TARGET: "aws-lambda-isolated-staging",
  NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: "true"
});
assert.equal(staged.isIsolatedWebPreviewEnabled(), true);
assert.equal(staged.stagingProxyAllowed("POST", ["api","v1","payments","initialize"]), false);
assert.equal(staged.stagingProxyAllowed("POST", ["api","v1","cart","checkout"]), false);
assert.equal(staged.stagingProxyAllowed("POST", ["api","v1","wallet","escrows","bookings","bk123","release"]), false);

const preview = load({
  HUSTLE_ISOLATED_PWA_GATE: "payment-preview",
  HUSTLE_API_BACKEND_TARGET: "payment-preview",
  NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: "true",
  HUSTLE_PAYMENT_PREVIEW_API_ORIGIN: "https://hustle-payment-preview-api.realxpens.workers.dev"
});
assert.equal(preview.isIsolatedWebPreviewEnabled(), true);
assert.equal(preview.selectedIsolatedBackendOrigin(), "https://hustle-payment-preview-api.realxpens.workers.dev");
const allow = [
 ["GET", ["api","v1","orders","ord1234"]],
 ["GET", ["api","v1","orders","buyer"]],
 ["POST", ["api","v1","cart","checkout"]],
 ["POST", ["api","v1","cart","checkout","preview"]],
 ["POST", ["api","v1","payments","initialize"]],
 ["POST", ["api","v1","payments","attempts","pay1234","verify"]],
 ["POST", ["api","v1","bookings","booking123","start"]],
 ["POST", ["api","v1","bookings","booking123","complete"]],
 ["POST", ["api","v1","wallet","escrows","bookings","booking123","release"]]
];
for(const [method,parts] of allow) {
  assert.equal(preview.paymentPreviewProxyAllowed(method,parts), true, method+" "+parts.join("/"));
}
const deny = [
 ["POST", ["api","v1","sandbox","wallet","withdrawals"]],
 ["POST", ["api","v1","sandbox","bookings","booking123","fund"]],
 ["POST", ["api","v1","wallet","withdrawals"]],
 ["POST", ["api","v1","wallet","refunds"]],
 ["POST", ["api","v1","payments","webhooks","paystack"]],
 ["POST", ["api","v1","admin","users"]],
 ["POST", ["api","v1","payments","attempts","id1234","live"]],
 ["POST", ["api","v1","payments","initialize%2fadmin"]]
];
for(const [method,parts] of deny) {
  assert.equal(preview.paymentPreviewProxyAllowed(method,parts), false, method+" "+parts.join("/"));
}
for (const broken of [
  { HUSTLE_ISOLATED_PWA_GATE: "isolated-staging", HUSTLE_API_BACKEND_TARGET: "payment-preview" },
  { HUSTLE_ISOLATED_PWA_GATE: "payment-preview", HUSTLE_API_BACKEND_TARGET: "aws-lambda-isolated-staging" },
  { HUSTLE_ISOLATED_PWA_GATE: "payment-preview", HUSTLE_PAYMENT_PREVIEW_API_ORIGIN: "https://attacker.example" },
  { HUSTLE_ISOLATED_PWA_GATE: "payment-preview", NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: "false" }
]) {
  const cfg = { HUSTLE_ISOLATED_PWA_GATE: "payment-preview",
    HUSTLE_API_BACKEND_TARGET: "payment-preview",
    HUSTLE_PAYMENT_PREVIEW_API_ORIGIN: "https://hustle-payment-preview-api.realxpens.workers.dev",
    NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH: "true", ...broken };
  const p = load(cfg);
  assert.equal(p.selectedIsolatedBackendOrigin(), null);
  assert.equal(p.isIsolatedWebPreviewEnabled(), false);
}
console.log("PASS: staged Worker still forbids finance; distinct preview proxy routes real checkout to the single reviewed API origin, denies sandbox/admin/wallet writes and rejects unsafe build flags.");
