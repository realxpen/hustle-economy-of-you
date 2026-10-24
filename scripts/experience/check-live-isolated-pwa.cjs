#!/usr/bin/env node
"use strict";
/**
 * Safe, anonymous GET-only acceptance against the two specifically pinned
 * isolated-staging origins. Runs in a disposable CI runner with NO secrets,
 * database writes or HTTP mutations. This is not a logged-in user journey.
 */
const assert = require("node:assert/strict");

const PWA = "https://hustle-ios-pwa-staging.realxpens.workers.dev";
const API = "https://hustle-isolated-staging-api.vercel.app";
const expectedRevision = process.env.HUSTLE_TESTED_COMMIT ?? "";
const checks = [
  {origin: PWA, path: "/manifest.webmanifest", status: 200, type: "json", verify: body => {
    assert.equal(body.start_url, "/home");
    assert.equal(body.display, "standalone");
  }},
  {origin: PWA, path: "/auth", status: 200, type: "html", contains: "PRIVATE TEST"},
  {origin: PWA, path: "/search", status: 200, type: "html"},
  {origin: PWA, path: "/hustler-application", status: 200, type: "html"},
  {origin: PWA, path: "/professional-profile", status: 200, type: "html"},
  {origin: PWA, path: "/services/manage", status: 200, type: "html"},
  {origin: PWA, path: "/internal/hustler-reviews", status: 200, type: "html"},
  {origin: PWA, path: "/api/isolated/auth/get-session", status: 200, type: "json", verify: body => {
    assert.equal(body, null, "Anonymous session must remain empty");
  }},
  {origin: PWA, path: "/api/isolated/api/v1/health", status: 200, type: "json", verify: body => {
    assert.equal(body.scope, "isolated-staging");
    assert.equal(body.dependencies.database, "connected");
    assert.equal(body.dependencies.auth, "connected");
    if (expectedRevision) assert.equal(body.revision, expectedRevision, "Worker must route to exact reviewed backend");
  }},
  {origin: PWA, path: "/api/isolated/api/v1/hustler-application", status: 401, type: "json"},
  {origin: PWA, path: "/api/isolated/api/v1/hustler-reviews", status: 401, type: "json"},
  {origin: PWA, path: "/api/isolated/api/v1/services/mine", status: 401, type: "json"},
  {origin: PWA, path: "/api/isolated/api/v1/storefronts/nonexistent-staging-pwa-111", status: 404, type: "json"},
  {origin: API, path: "/api/v1/health", status: 200, type: "json", verify: body => {
    assert.equal(body.scope, "isolated-staging");
    if (expectedRevision) assert.equal(body.revision, expectedRevision);
  }}
];

async function get(check) {
  const url = new URL(check.path, check.origin);
  assert.equal(url.origin, check.origin);
  const response = await fetch(url, {
    method: "GET", redirect: "manual",
    headers: { accept: check.type === "json" ? "application/json" : "text/html" },
    signal: AbortSignal.timeout(16000)
  });
  const type = response.headers.get("content-type") || "";
  const validType = check.type === "json" ? /application\/json/ : /text\/html/;
  assert.match(type, validType, check.path + " content-type");
  assert.equal(response.status, check.status, check.path + " status");
  if (check.contains || check.verify) {
    const raw = await response.text();
    assert.ok(raw.length < 400000, "Unexpected response size");
    if (check.contains) assert.ok(raw.includes(check.contains), check.path + " expected page content");
    if (check.verify) check.verify(JSON.parse(raw));
  } else await response.body?.cancel();
  console.log("PASS GET " + check.origin.replace("https://", "") + check.path + " [" + response.status + "]");
}

async function main() {
  assert.equal(process.env.HUSTLE_LIVE_STAGING_READ_ONLY, "GET_ONLY");
  for (const c of checks) await get(c);
  console.log("PASS isolated live Worker + staging API: 14 GET-only probes, no credentials, no data mutation");
}
main().catch(e => { console.error("FAIL isolated staging acceptance:", e.message); process.exitCode = 1; });
