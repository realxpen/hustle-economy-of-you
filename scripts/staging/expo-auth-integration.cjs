#!/usr/bin/env node
// Disposable local PostgreSQL only. No hosted credentials or production access.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const { toNodeHandler } = require("better-auth/node");
const { PrismaClient } = require("../../apps/api/node_modules/@hustle/staging-auth-client");
const { createExpoStagingAuth, ExpoStagingAuthService } = require("../../apps/api/dist/auth/expo-staging-auth.service");
const target = new URL(process.env.STAGING_AUTH_DATABASE_URL || "");
assert.ok(["localhost", "127.0.0.1"].includes(target.hostname), "Only disposable localhost DB accepted");
assert.equal(target.searchParams.get("schema"), "hustle_auth");
const database = new PrismaClient();
let app;
const password = randomBytes(24).toString("base64url");
const email = "expo-fixture@example.invalid";
const baseURL = "http://127.0.0.1:43181/api/auth";
const auth = createExpoStagingAuth(database, { baseURL, secret: randomBytes(48).toString("base64url"), allowedEmails: [email] });
const port = new ExpoStagingAuthService(() => auth);
async function request(path, body, headers = {}) {
  return fetch(`${baseURL}${path}`, { method: body ? "POST" : "GET", redirect: "error",
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}) });
}
async function check(name, fn) { await fn(); console.log(`PASS: ${name}`); }
(async () => {
  class FixtureModule {}
  Module({})(FixtureModule);
  app = await NestFactory.create(FixtureModule, { logger: false, rawBody: true });
  app.getHttpAdapter().getInstance().all("/api/auth/*splat", toNodeHandler(auth));
  await app.listen(43181, "127.0.0.1");
  await check("Uninvited registration refused without creating an identity", async () => {
    const r = await request("/sign-up/email", { email: "outsider@example.invalid", password, name: "Test" }, { "expo-origin": "hustle-preview://" });
    assert.equal(r.status, 403);
    assert.equal(await database.user.count(), 0);
  });
  let token, cookie, subject;
  await check("Official Expo origin signs up through actual Nest HTTP handler and hashes password", async () => {
    const r = await request("/sign-up/email", { email, password, name: "Test" }, { "expo-origin": "hustle-preview://" });
    assert.equal(r.status, 200);
    const body = await r.json();
    token = body.token; subject = body.user.id;
    assert.ok(token && subject);
    cookie = r.headers.get("set-cookie").split(";")[0];
    const account = await database.account.findFirst();
    assert.ok(account.password && account.password !== password && !account.password.includes(password));
    assert.equal(await database.user.count(), 1);
  });
  await check("Foreign origins and wrong passwords refused", async () => {
    assert.equal((await request("/sign-in/email", { email, password }, { "expo-origin": "foreign-app://" })).status, 403);
    assert.equal((await request("/sign-in/email", { email, password: "deliberately-wrong-password" }, { "expo-origin": "hustle-preview://" })).status, 401);
  });
  await check("Stored Expo cookie restores session; existing Bearer AuthPort resolves same identity", async () => {
    const r = await request("/get-session", undefined, { cookie, "expo-origin": "hustle-preview://" });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.user.id, subject);
    assert.equal(body.session.token, token);
    assert.deepEqual(await port.verifyAccessToken(token), { subject, email, emailVerified: false, phoneVerified: false });
    await assert.rejects(() => port.verifyAccessToken(randomBytes(32).toString("base64url")));
    await assert.rejects(() => port.verifyAccessToken("eyJhbGciOiJub25lIn0.eyJzdWIiOiJhZG1pbiJ9."));
  });
  await check("Server sign-out revokes both cookie and Bearer access", async () => {
    assert.equal((await request("/sign-out", {}, { cookie, "expo-origin": "hustle-preview://" })).status, 200);
    await assert.rejects(() => port.verifyAccessToken(token));
    const r = await request("/get-session", undefined, { cookie });
    assert.equal(await r.json(), null);
  });
  await check("Fresh password sign-in works and database expiry is enforced", async () => {
    const r = await request("/sign-in/email", { email, password }, { "expo-origin": "hustle-preview://" });
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal((await port.verifyAccessToken(body.token)).subject, subject);
    await database.session.updateMany({ data: { expiresAt: new Date(Date.now() - 60_000) } });
    await assert.rejects(() => port.verifyAccessToken(body.token));
  });
  console.log("PASS: Local database-backed Expo server integration. Physical native SecureStore/device acceptance remains separate.");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await app?.close(); await database.$disconnect();
});
