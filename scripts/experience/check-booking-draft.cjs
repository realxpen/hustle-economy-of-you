#!/usr/bin/env node
/** Real TypeScript booking-draft helper with in-memory sessionStorage only. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const text = fs.readFileSync("apps/web/lib/booking-draft.ts", "utf8");
const compiled = ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true }
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", compiled)(mod, mod.exports);
const { readBookingDraft, saveBookingDraft, clearBookingDraft, BOOKING_DRAFT_TTL_MS } = mod.exports;
const map = new Map();
const storage = {
  setItem: (k, v) => map.set(k, v),
  getItem: (k) => map.get(k) ?? null,
  removeItem: (k) => map.delete(k)
};
const payload = {
  requestedStartAt: "2026-10-25T14:30", requestedEndAt: "",
  requirements: "I need this test-only booking", location: "Lagos",
  notes: "Please confirm availability"
};
const now = 10_000_000;
assert.equal(saveBookingDraft(storage, "service-A", payload, now), true);
assert.deepEqual(readBookingDraft(storage, "service-A", now + 3), payload);
assert.equal(readBookingDraft(storage, "service-B", now), null, "Draft is service-scoped");
assert.equal(readBookingDraft(storage, "service-A", now + BOOKING_DRAFT_TTL_MS + 1), null, "Expired draft cannot leak");
assert.equal(map.size, 0, "Expired draft removed");
assert.equal(saveBookingDraft(storage, "../service-A", payload, now), false);
assert.equal(saveBookingDraft(storage, "service-A", { ...payload, notes: "x".repeat(2001) }, now), false);
assert.equal(saveBookingDraft(storage, "service-A", payload, now), true);
const key = [...map.keys()][0];
map.set(key, "{");
assert.equal(readBookingDraft(storage, "service-A", now), null, "Corrupt storage is discarded");
assert.equal(map.size, 0);
assert.equal(saveBookingDraft(storage, "service-A", payload, now), true);
const invalid = JSON.parse(map.get(key));
invalid.serviceId = "service-B";
map.set(key, JSON.stringify(invalid));
assert.equal(readBookingDraft(storage, "service-A", now), null, "Cross-service payload rejected");
assert.equal(readBookingDraft(null, "service-A", now), null);
assert.equal(saveBookingDraft(null, "service-A", payload, now), false);
assert.equal(saveBookingDraft({ setItem() { throw Error("Quota"); } }, "service-A", payload, now), false);
assert.equal(saveBookingDraft(storage, "service-A", payload, now), true);
clearBookingDraft(storage, "service-A");
assert.equal(map.size, 0, "Successful booking/clear removes draft");

const form = fs.readFileSync("apps/web/app/bookings/new/[serviceId]/page.tsx", "utf8");
assert.match(form, /readBookingDraft\(tabStorage\(\), serviceId\)/, "Restore draft only after matching public Service loads");
assert.match(form, /saveBookingDraft\(tabStorage\(\), data\.service\.id, draftFields\(\)\)/, "Save before authentication handoff");
assert.match(form, /clearBookingDraft\(tabStorage\(\), data\.service\.id\)/, "Clear only after successful create");
assert.match(form, /authUrlFor\(window\.location\.pathname \+ window\.location\.search\)/, "Preserve return route");
assert.match(form, /type="button" onClick=\{discardDraft\}/, "User can clear tab-scoped draft");
assert.match(form, /getSupabaseBrowserClient\(\)\.auth\.getSession\(\)/, "Do not attempt booking write if signed out");
console.log("PASS: tab-only booking drafts, expiry, isolation, clear and auth handoff contracts");
