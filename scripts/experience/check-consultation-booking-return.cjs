#!/usr/bin/env node
/**
 * Real shared navigation policy + consolidated contract for consultation
 * round trips. No service writes, authentication tokens or external requests.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const src = fs.readFileSync("apps/web/lib/transaction-return.ts", "utf8");
const output = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true }
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", output)(mod, mod.exports);
const { safeTransactionReturnTo, withTransactionReturnTo, transactionReturnLabel } = mod.exports;

const valid = [
  "/bookings/booking-123", "/orders/order-456",
  "/bookings/new/qa-service",
  "/bookings/new/qa-service?sourcePost=post-123456"
];
for (const path of valid) {
  assert.equal(safeTransactionReturnTo(path), path, "Valid return path must survive: "+path);
  const next = withTransactionReturnTo("/messages/start?userId=hustler123&contextType=SERVICE&contextId=qa-service", path);
  assert.equal(new URL(next, "https://hustle.invalid").searchParams.get("returnTo"), path);
}
assert.equal(transactionReturnLabel("/bookings/new/qa-service"), "Continue booking request");
assert.equal(transactionReturnLabel("/bookings/booking-123"), "Back to booking");
assert.equal(transactionReturnLabel("/orders/order-456"), "Back to order");

const unsafe = [
  "https://malicious.example", "//malicious.example", "/auth",
  "/bookings/new/../other", "/bookings/new/%2e%2e",
  "/bookings/new/qa-service?returnTo=https://malicious.example",
  "/bookings/new/qa-service?sourcePost=bad!",
  "/bookings/new/qa-service?sourcePost=post-valid&other=1",
  "/bookings/new/qa-service?sourcePost=post-valid&sourcePost=post-other",
  "/bookings/new/qa-service?", "/bookings/new/qa-service#x",
  "/bookings/booking-123?status=FUNDED",
  "/orders/order-456?provider=PAID",
  "/bookings/new/a\\evil", "/bookings/new/qa-service\nheader",
  "/bookings/new/"+"x".repeat(129), null, ""
];
for (const path of unsafe) {
  assert.equal(safeTransactionReturnTo(path), null, "Unsafe return rejected: "+String(path));
  assert.equal(withTransactionReturnTo("/messages/start", path), "/messages/start");
}

const read = (path) => fs.readFileSync(path, "utf8");
const booking = read("apps/web/app/bookings/new/[serviceId]/page.tsx");
const service = read("apps/web/app/services/[serviceId]/page.tsx");
const start = read("apps/web/app/messages/start/page.tsx");
const thread = read("apps/web/app/messages/[conversationId]/page.tsx");
assert.match(service, /const consultHref = withTransactionReturnTo\(/, "Service Message first offers return to Booking");
assert.match(service, /withSourcePost\(`\/bookings\/new\//, "Return preserves proof Post attribution");
assert.match(booking, /const bookingReturn = withSourcePost\(/, "Prepared draft retains Post attribution");
assert.match(booking, /const consultHref = withTransactionReturnTo\(/, "Consultation is reversible from booking");
assert.match(booking, /href=\{consultHref\}/, "Booking consultation actually uses return link");
assert.match(start, /candidateReturn\.split\("\?"\)\[0\] !==/, "Start route prevents mismatched Service return");
assert.match(start, /nextParams\.set\("returnTo", safeReturn\)/, "Conversation redirect keeps safe return");
assert.match(thread, /transactionReturnLabel\(returnTo\)/, "Thread offers continue Booking action");
assert.match(thread, /Your draft stays in this browser tab/, "Conversation distinguishes draft from payment status");
assert.match(thread, /router\.replace\(authUrlFor\(window\.location\.pathname \+ window\.location\.search\)\)/, "Thread retains intent on auth expiration");
console.log("PASS: Consult-first Service + prepared Booking return policy, context and copy");
