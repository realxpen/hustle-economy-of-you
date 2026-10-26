#!/usr/bin/env node
// Static contract only. Live signed-in 403 proof requires the iPhone QA page.
// Never use production, auth secrets, fixtures in nonterminal states or money routes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = path => fs.readFileSync(path, "utf8");

const page = read("apps/web/app/qa/ux009/page.tsx");
const client = read("apps/web/app/qa/ux009/ux009-authorization-check.tsx");
const booking = read("apps/api/src/booking/booking.service.ts");
const authenticated = read("apps/web/lib/api/authenticated-fetch.ts");

assert.match(page, /HUSTLE_ISOLATED_PWA_GATE !== "isolated-staging"/);
assert.match(page, /NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH !== "true"/);
assert.match(page, /notFound\(\)/, "A non-staging deployment must serve 404");

assert.match(client, /SAFE_COMPLETED_BOOKING_ID = "cmvoab8rz0003kz05f3cvn575"/);
assert.match(client, /booking\.status !== "COMPLETED"/);
assert.match(client, /booking\.timeProposalStatus !== "ACCEPTED"/);
assert.match(client, /booking\.clientUserId === booking\.hustlerUserId/);
assert.match(client, /\/accept\`/);
assert.match(client, /\/respond-time\`/);
assert.match(client, /status === 403 && unchanged/, "HTTP 403 and unchanged state are both required");
assert.match(authenticated, /class AuthenticatedApiError extends Error/, "HTTP errors must preserve their status");
assert.match(authenticated, /new AuthenticatedApiError\(response.status, await parseError\(response\)\)/,
  "Non-2xx API errors must retain HTTP code, without exposing tokens or response payload");
assert.match(client, /reason instanceof AuthenticatedApiError/,
  "Expected HTTP 403 is a typed server denial, not a network failure");
assert.match(client, /status = reason.status/, "The diagnostic must show the real HTTP response");
assert.match(client, /const after = await loadSafeBooking\(\)/,
  "A 403 must be followed by an independent read-only booking state check");
assert.match(client, /after\.updatedAt === booking\.updatedAt/);
assert.match(client, /state\.stage !== "ready"/);
assert.doesNotMatch(client, /\/sandbox\/|\/release|\/fund|\/withdraw|\/payments\//, "No financial or escrow action");
assert.doesNotMatch(client, /localStorage|sessionStorage|console\.log/, "No session or raw security result persisted");
assert.match(booking, /Only the booked Hustler can accept this Booking/);
assert.match(booking, /Only the Client can accept or decline a proposed time/);
assert.match(booking, /Booking cannot be accepted from \$\{booking\.status\}/);
assert.match(booking, /Time proposal is no longer pending/);
console.log("PASS: UX009 signed-in HTTP 403 diagnostic preserves status, reads booking invariants and avoids financial routes");
