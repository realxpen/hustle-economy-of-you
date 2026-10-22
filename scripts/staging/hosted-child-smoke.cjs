"use strict";
// Explicit isolated child acceptance. No database password, personal accounts,
// financial operations or provider calls. Tokens/passwords never reach output.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const base = "https://hustle-isolated-staging-api.vercel.app";
const commit = process.env.HUSTLE_EXPECTED_SHA;
const email = process.env.HUSTLE_SMOKE_EMAIL;
assert.match(commit || "", /^[a-f0-9]{40}$/);
assert.match(email || "", /^[a-zA-Z0-9._+-]+@example\.invalid$/);
const sessionFile = process.env.HUSTLE_SMOKE_SESSION_FILE;
if (sessionFile) assert.match(sessionFile, /^\/tmp\/hustle-child-smoke-[a-z0-9-]+\.json$/);
async function call(path, method = "GET", body, token) {
  const response = await fetch(base + path, {
    method, redirect: "error", signal: AbortSignal.timeout(30000),
    headers: { "content-type": "application/json", "expo-origin": "hustle-preview://",
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let data; try { data = await response.json(); } catch {}
  return { status: response.status, data };
}
async function run() {
  if (process.argv.includes("--verify-expired")) {
    assert.ok(sessionFile);
    const session = JSON.parse(fs.readFileSync(sessionFile, "utf8"));
    assert.equal((await call("/api/v1/auth/me", "GET", undefined, session.token)).status, 401);
    console.log("PASS: hosted expired session denied by protected Nest API");
    fs.unlinkSync(sessionFile);
    return;
  }
  const health = await call("/api/v1/health");
  assert.equal(health.status, 200, "health status");
  assert.equal(health.data.scope, "isolated-staging", "isolated scope");
  assert.equal(health.data.revision, commit, "exact deployed commit");
  assert.equal(health.data.dependencies.database, "connected", "restricted database connectivity");
  console.log("PASS: exact hosted staging revision and connected database");
  for (const route of ["bookings", "payments", "media/upload", "orders", "admin/operations/cases", "unknown-write"]) {
    const r = await call(`/api/v1/${route}`, "POST", {});
    assert.equal(r.status, 403, "disabled mutation");
    assert.equal(r.data?.error?.code, "STAGING_ROUTE_DISABLED", "server-side staging gate");
  }
  assert.equal((await call("/api/v1/auth/me")).status, 401, "anonymous denied");
  assert.equal((await call("/api/v1/auth/me", "GET", undefined, randomBytes(32).toString("base64url"))).status, 401, "invalid session denied");
  console.log("PASS: commerce/upload/unknown writes blocked; anonymous and invalid sessions denied");
  const password = randomBytes(32).toString("base64url");
  assert.equal((await call("/api/auth/sign-up/email", "POST", {
    email: "uninvited-child-smoke@example.invalid", password, name: "Uninvited test"
  })).status, 403, "uninvited signup denied");
  const signup = await call("/api/auth/sign-up/email", "POST", { email, password, name: "Disposable staging check" });
  assert.equal(signup.status, 200, "invited signup");
  assert.ok(typeof signup.data?.token === "string" && signup.data.token.length > 20, "opaque session returned");
  const token = signup.data.token;
  assert.equal((await call("/api/v1/auth/sync", "POST", {}, token)).status, 201, "account sync");
  assert.equal((await call("/api/v1/auth/me", "GET", undefined, token)).status, 200, "protected account read");
  assert.equal((await call("/api/auth/sign-out", "POST", {}, token)).status, 200, "signout");
  assert.equal((await call("/api/v1/auth/me", "GET", undefined, token)).status, 401, "revoked session denied");
  console.log("PASS: invited signup, account sync, protected API and signout revocation");
  const login = await call("/api/auth/sign-in/email", "POST", { email, password });
  assert.equal(login.status, 200, "password signin");
  assert.equal((await call("/api/v1/auth/me", "GET", undefined, login.data.token)).status, 200, "restored signed-in session");
  if (sessionFile) {
    fs.writeFileSync(sessionFile, JSON.stringify({ token: login.data.token }), { mode: 0o600, flag: "wx" });
    console.log("PASS: password sign-in and session restoration; expiry check pending");
  } else {
    assert.equal((await call("/api/auth/sign-out", "POST", {}, login.data.token)).status, 200);
    console.log("PASS: fresh password sign-in and second signout");
  }
  console.log("BOUNDARY: hosted HTTP acceptance only; physical native device remains untested");
}
run().catch(error => {
  console.error("HOSTED_CHILD_SMOKE_FAILED", error.code === "ERR_ASSERTION" ? error.message.split("\n")[0] : "NETWORK_OR_RUNTIME_FAILURE");
  process.exitCode = 1;
});
