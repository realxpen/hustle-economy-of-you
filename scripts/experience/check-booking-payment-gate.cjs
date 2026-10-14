#!/usr/bin/env node
// Static regression protecting parity between Web Booking actions and the API state gate.
// This is NOT signed-in runtime QA or payment-settlement verification.
const fs = require("node:fs");
const assert = require("node:assert/strict");
const read = (name) => fs.readFileSync(name, "utf8");
const ui = read("apps/web/app/bookings/[bookingId]/page.tsx");
const finance = read("apps/web/components/finance/transaction-finance-actions.tsx");
const api = read("apps/api/src/booking/booking.service.ts");
assert.match(api, /booking\.agreedPriceMinor > 0\s*\? BookingStatus\.FUNDED\s*:\s*BookingStatus\.ACCEPTED/, "API distinguishes paid vs free work start");
assert.match(ui, /booking\.status === "ACCEPTED" && !booking\.paymentBoundary\.required/, "Only accepted free Bookings may start without funding");
assert.match(ui, /booking\.status === "FUNDED" && booking\.paymentBoundary\.funded/, "Paid start requires server-funded boundary");
assert.doesNotMatch(ui, /\["ACCEPTED", "FUNDED"\]\.includes\(booking\.status\)/, "Do not expose paid start on status alone");
assert.match(ui, /Check Financial State below to distinguish sandbox simulation/, "Do not imply real money from booking status");
assert.match(finance, /Signed sandbox fixture applied to this transaction\. No actual funds were collected or settled/, "Sandbox confirmation is not real settlement");
assert.match(finance, /Release simulated escrow/, "Simulated escrow release is explicitly labeled");
console.log("PASS: Booking paid/free work-start and sandbox finance UI contracts");
