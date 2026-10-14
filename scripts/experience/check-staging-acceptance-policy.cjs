#!/usr/bin/env node
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { nonProductionOrigin, privateStateFile, prepare } = require("./staging-acceptance-policy.cjs");

const valid = "https://staging.hustle.example.com";
assert.equal(nonProductionOrigin(valid, valid), valid);
for (const raw of [
  "https://hustle.example.com", "https://staging.hustle.example.com.evil.com",
  "https://staging.example.com/booking", "http://staging.example.com",
  "https://preview.example.com:8443", "https://user:secret@staging.example.com",
  "https://staging.example.com?next=evil", "https://staging.example.com/#fragment",
  "http://127.0.0.1:3001", "https://qa.localhost"
]) {
  assert.throws(() => nonProductionOrigin(raw, raw), undefined, "Reject unapproved staging URL: " + raw);
}
assert.throws(() => nonProductionOrigin(valid, "https://qa.other.example.com"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hustle-qa-policy-"));
const alice = path.join(dir, "client.json"), bob = path.join(dir, "hustler.json");
const stagingState = JSON.stringify({
  cookies: [{ name: "TEST_FIXTURE_NO_TOKEN", value: "fixture", domain: "staging.hustle.example.com", path: "/" }],
  origins: []
});
try {
  fs.writeFileSync(alice, stagingState, { mode: 0o600 });
  fs.writeFileSync(bob, stagingState, { mode: 0o600 });
  fs.chmodSync(alice, 0o600);
  fs.chmodSync(bob, 0o600);
  assert.equal(privateStateFile(alice), fs.realpathSync(alice));
  const good = {
    HUSTLE_QA_CONFIRM: "NONPRODUCTION_READ_ONLY",
    HUSTLE_QA_WEB_ORIGIN: valid,
    HUSTLE_QA_APPROVED_ORIGIN: valid,
    HUSTLE_QA_CLIENT_STATE: alice,
    HUSTLE_QA_HUSTLER_STATE: bob,
    HUSTLE_QA_CLIENT_HANDLE: "client-qa",
    HUSTLE_QA_HUSTLER_HANDLE: "hustler-qa",
    HUSTLE_QA_SERVICE_ID: "service-qa"
  };
  assert.equal(prepare(good).origin, valid);
  for (const patch of [
    { HUSTLE_QA_CONFIRM: "" },
    { HUSTLE_QA_APPROVED_ORIGIN: "https://qa.attacker.example.com" },
    { HUSTLE_QA_HUSTLER_HANDLE: "client-qa" },
    { HUSTLE_QA_CLIENT_STATE: "./test.json" },
    { HUSTLE_QA_SERVICE_ID: "???" }
  ]) assert.throws(() => prepare({ ...good, ...patch }));
  fs.chmodSync(bob, 0o644);
  if (process.platform !== "win32") assert.throws(() => prepare(good), /permissions/);

  const runner = fs.readFileSync("scripts/experience/staging-authenticated-acceptance.cjs", "utf8");
  assert.match(runner, /const config = prepare\(process\.env\)/);
  assert.match(runner, /browser\.newContext\(\{ storageState: config\.clientState/);
  assert.match(runner, /browser\.newContext\(\{ storageState: config\.hustlerState/);
  assert.doesNotMatch(runner, /\.click\(\).*Submit booking request|startPayment\(|initializePayment\(|releaseBookingEscrow\(/);
  const denied = spawnSync(process.execPath,
    ["scripts/experience/staging-authenticated-acceptance.cjs"],
    { env: { ...process.env, HUSTLE_QA_CONFIRM: "" }, encoding: "utf8", timeout: 10000 });
  assert.notEqual(denied.status, 0, "Without explicit staging approval, runner must fail closed");
  assert.match(denied.stderr, /INCOMPLETE staging authenticated acceptance/);
  console.log("PASS: staging acceptance requires explicit nonproduction origin, two private sessions and read-only checks");
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
