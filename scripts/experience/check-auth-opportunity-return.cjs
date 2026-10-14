#!/usr/bin/env node
/**
 * Test the real shared TypeScript auth destination helper in Node after
 * TypeScript-only transpilation. No auth provider, secrets or network calls.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const helper = read("apps/web/lib/auth/safe-auth-next.ts");
const compiled = ts.transpileModule(helper, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    strict: true
  }
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { safeAuthNext, authUrlFor, onboardingUrlFor } = mod.exports;

const valid = [
  "/bookings/new/qa-service",
  "/bookings/booking-123",
  "/messages/start?userId=provider-1&contextType=SERVICE&contextId=service-1",
  "/services/service-1?sourcePostId=post-2",
  "/orders/order-123",
  "/home", "/marketplace", "/account", "/u/creator-1"
];
for (const next of valid) {
  assert.equal(safeAuthNext(next), next, "Expected local opportunity path: " + next);
  assert.equal(new URLSearchParams(authUrlFor(next).split("?")[1]).get("next"), next);
  assert.equal(new URLSearchParams(onboardingUrlFor(next).split("?")[1]).get("next"), next);
}

const unsafe = [
  "https://phishing.example", "http://phishing.example", "//phishing.example",
  "/\\phishing.example", "/%5cphishing.example", "/%2f%2fphishing.example",
  "javascript:alert(1)", "data:text/html,test", "bookings/new/qa-service",
  "/auth", "/auth/callback", "/onboarding", "/api/v1/auth/sync",
  "/admin", "/@hustler", "/bookings/new/../../auth", "/bookings/new/%2e%2e/auth",
  "/bookings/new/" + "x".repeat(130),
  "/bookings/new/qa-service\nLocation: https://phishing.example",
  "/messages/start?" + "x".repeat(2048), null, ""
];
for (const next of unsafe) {
  assert.equal(safeAuthNext(next), null, "Must reject unsafe redirect: " + String(next));
  assert.equal(authUrlFor(next), "/auth");
  assert.equal(onboardingUrlFor(next), "/onboarding");
}

const auth = read("apps/web/app/auth/page.tsx");
const callback = read("apps/web/app/auth/callback/route.ts");
const onboarding = read("apps/web/app/onboarding/page.tsx");
const booking = read("apps/web/app/bookings/new/[serviceId]/page.tsx");
const message = read("apps/web/app/messages/start/page.tsx");

assert.match(auth, /const next = requestedOpportunity\(\)/, "Login preserves opportunity context");
assert.match(auth, /onboardingUrlFor\(next\)/, "Incomplete accounts finish onboarding first");
assert.match(auth, /callbackUrl\.searchParams\.set\("next", next\)/, "Email verification preserves destination");
assert.match(callback, /onboardingUrlFor\(url\.searchParams\.get\("next"\)\)/, "Email callback rejects open redirects");
assert.doesNotMatch(callback, /new URL\(next, url\.origin\)/, "No arbitrary external callback redirection");
assert.match(onboarding, /safeAuthNext\(new URLSearchParams\(window\.location\.search\)\.get\("next"\)\)/);
assert.match(booking, /authUrlFor\(window\.location\.pathname \+ window\.location\.search\)/,
  "Booking returns to original offer after sign-in");
assert.match(message, /authUrlFor\(window\.location\.pathname \+ window\.location\.search\)/,
  "Service consultation returns to original thread context after sign-in");

console.log("PASS: safe auth return helper + signup/onboarding/booking/consultation source contracts");
