#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import handler from "../../infra/neon/staging/health/index.mjs";

const origin = "https://staging.invalid";
const get = async (route, method = "GET") =>
  handler.fetch(new Request(origin + route, { method }));

for (const route of ["/", "/health"]) {
  const response = await get(route);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  const payload = await response.json();
  assert.equal(payload.project, "Hustle");
  assert.equal(payload.environment, "isolated-staging");
  assert.equal(payload.check, "hosting-only");
  assert.equal(payload.connectedApiReady, false);
  assert.equal(payload.liveAuthenticationTested, false);
  assert.equal(payload.bookingWritesEnabled, false);
  assert.equal(payload.financialProvidersEnabled, false);
  assert.equal(payload.status, "reachable");
  console.log("PASS: " + route + " reports hosting-only status, not app acceptance");
}
for (const route of ["/users", "/api/v1/search", "/auth", "/bookings/slots"]) {
  const response = await get(route);
  assert.equal(response.status, 404);
}
for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
  const response = await get("/health", method);
  assert.equal(response.status, 405);
}
const source = readFileSync(new URL("../../infra/neon/staging/health/index.mjs", import.meta.url), "utf8");
assert.doesNotMatch(source, /\bDATABASE_URL\b|\bglobalThis\.fetch\s*\(|\bawait\s+fetch\s*\(|\bprocess\.env\b|@supabase|\bprisma\b|\bpayment\s*\(/);
console.log("PASS: only GET health endpoint, no network/database/financial side effects");
