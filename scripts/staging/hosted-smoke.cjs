"use strict";
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const base = "https://hustle-isolated-staging-api.vercel.app";
const commit = process.env.HUSTLE_EXPECTED_SHA;
assert.match(commit || "", /^[a-f0-9]{40}$/);
const email = `hustle-smoke-${commit.slice(0, 12)}@example.invalid`;
const password = randomBytes(32).toString("base64url");
async function call(path, method = "GET", body, token) {
  return fetch(base + path, { method, redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { "content-type": "application/json", "expo-origin": "hustle-preview://",
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function run() {
  let ready = false;
  const deadline = Date.now() + 12 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      const r = await call("/api/v1/health"); const health = await r.json();
      ready = r.status === 200 && health.scope === "isolated-staging" && health.revision === commit &&
        health.dependencies?.database === "connected";
    } catch {}
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 15000));
  }
  assert.ok(ready, "Exact staging revision/database never became ready");
  console.log("PASS: exact hosted staging revision and database health");
  for (const route of ["bookings", "payments", "media/upload", "orders", "admin/operations/cases"]) {
    assert.equal((await call(`/api/v1/${route}`, "POST", {})).status, 403);
  }
  assert.equal((await call("/api/v1/auth/me")).status, 401);
  console.log("PASS: booking/payment/upload writes and anonymous account access denied");
  const signed = await call("/api/auth/sign-up/email", "POST", { email, password, name: "Disposable staging check" });
  assert.equal(signed.status, 200, "Invited hosted signup failed");
  const identity = await signed.json(); const token = identity.token;
  assert.ok(typeof token === "string" && token.length > 20);
  const sync = await call("/api/v1/auth/sync", "POST", {}, token);
  assert.equal(sync.status, 201, "Hosted account sync failed");
  assert.equal((await call("/api/v1/auth/me", "GET", undefined, token)).status, 200);
  assert.equal((await call("/api/auth/sign-out", "POST", {}, token)).status, 200);
  assert.equal((await call("/api/v1/auth/me", "GET", undefined, token)).status, 401);
  console.log("PASS: actual hosted signup, account sync, protected identity and sign-out revocation");
  const login = await call("/api/auth/sign-in/email", "POST", { email, password });
  assert.equal(login.status, 200, "Hosted password sign-in failed");
  const session = await login.json();
  assert.equal((await call("/api/auth/sign-out", "POST", {}, session.token)).status, 200);
  console.log("PASS: fresh hosted password sign-in and second revocation; native device untested");
}
run().catch(() => { console.error("HOSTED_STAGING_SMOKE_FAILED: no session or private response printed"); process.exitCode = 1; });
