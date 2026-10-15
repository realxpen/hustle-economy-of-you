#!/usr/bin/env node
/**
 * Booking response UI source/SSR contracts, plus actual Nest Booking state
 * boundaries. No test customers, identity tokens or Booking mutations.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const read = (p) => fs.readFileSync(p, "utf8");

const detail = read("apps/web/app/bookings/[bookingId]/page.tsx");
const manager = read("apps/web/app/bookings/page.tsx");
const panel = read("apps/web/components/booking/booking-decision-panel.tsx");
const api = read("apps/api/src/booking/booking.service.ts");
const css = read("apps/web/app/bookings/bookings.module.css");

assert.doesNotMatch(detail, /window\.(?:prompt|confirm)\s*\(/, "Browser dialogs must not make irreversible decisions");
assert.match(detail, /onClick=\{\(\) => openDecision\("DECLINE"\)\}/, "Decline click only opens a confirmation panel");
assert.match(detail, /onClick=\{\(\) => openDecision\("CANCEL"\)\}/, "Cancel click only opens a confirmation panel");
assert.match(detail, /onConfirm=\{submitDecision\}/, "Only explicit confirmation may invoke booking transition");
assert.match(detail, /if \(!booking \|\| !decision \|\| busy\) return/, "Cannot mutate without intentional decision");
assert.match(detail, /decision === "DECLINE" && \(booking\.viewerRole !== "HUSTLER" \|\| booking\.status !== "REQUESTED"\)/,
  "Only its Hustler may decline a still-requested Booking");
assert.match(detail, /booking\.viewerRole === "CLIENT"/, "Respect original Client/Hustler cancellation policy");
assert.match(detail, /\["REQUESTED", "ACCEPTED", "PAYMENT_PENDING"\]\.includes\(booking\.status\)/,
  "Client cancellation status boundary");
assert.match(detail, /\["ACCEPTED", "PAYMENT_PENDING"\]\.includes\(booking\.status\)/,
  "Hustler cancellation status boundary");
assert.match(detail, /new Date\(start\)\.getTime\(\) <= Date\.now\(\)/, "Cannot confirm elapsed appointment schedule");
assert.match(detail, /setDecision\(null\);[\s\S]*?setDecisionReason\(" "\)|setDecision\(null\);[\s\S]*?setDecisionReason\("")/,
  "Successful response clears confirmation");
assert.match(panel, /onSubmit=\{submit\}/, "Confirm must be a real form submit");
assert.match(panel, /event\.preventDefault\(\)/, "No implicit page navigation");
assert.match(panel, /if \(!busy\) onConfirm\(\)/, "Only explicit submit while idle invokes confirmation");
assert.match(panel, /type="button" disabled=\{busy\} onClick=\{onDismiss\}/,
  "Dismiss never submits or calls booking transition");
assert.match(panel, /maxLength=\{1000\}/, "Align optional reason with Nest 1000-char limit");
assert.match(panel, /onReasonChange\(event\.target\.value\)/, "Reason is user-editable");
assert.match(manager, /booking\.status === "REQUESTED"/, "Pending request queue is based on server status");
assert.match(manager, /awaitingResponse\.map\(\(booking\) => <BookingCard/, "Queue has real Booking destinations");
assert.match(manager, /otherBookings\.map\(\(booking\) => <BookingCard/, "Other Bookings remain accessible");
assert.match(manager, /Refresh requests/, "Hustler can refresh pending requests");
assert.match(css, /\.decisionPanel\{/, "Confirmation is visually distinct");

assert.match(api, /if \(booking\.status !== BookingStatus\.REQUESTED\)/, "Decline only from requested state");
assert.match(api, /: \[BookingStatus\.ACCEPTED, BookingStatus\.PAYMENT_PENDING\]/, "Hustler cancel boundary enforced by API");
assert.match(api, /\? \[BookingStatus\.REQUESTED, BookingStatus\.ACCEPTED, BookingStatus\.PAYMENT_PENDING\]/,
  "Client cancel boundary enforced by API");
assert.match(api, /\? BookingStatus\.FUNDED\s*:\s*BookingStatus\.ACCEPTED/, "Backend gates paid vs free start");

const compiled = ts.transpileModule(panel, {
  fileName: "booking-decision-panel.tsx",
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, strict: true }
}).outputText;
assert.match(compiled, /exports\.BookingDecisionPanel/, "Confirmation component compiles");
const mod = { exports: {} };
new Function("module", "exports", "require", compiled)(mod, mod.exports, (id) => {
  if (id.endsWith(".module.css")) return {
    decisionPanel: "panel", decisionButtons: "buttons", danger: "danger", secondary: "secondary"
  };
  return require(id);
});
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
for (const [decision, label] of [["DECLINE", "Confirm decline"], ["CANCEL", "Confirm cancellation"]]) {
  const markup = renderToStaticMarkup(React.createElement(mod.exports.BookingDecisionPanel, {
    decision, reason: "I cannot meet the schedule.", onReasonChange() {}, onDismiss() {}, onConfirm() {}, busy: false
  }));
  assert.match(markup, new RegExp(label), "Confirmation action is rendered");
  assert.match(markup, /Keep booking/, "Safe dismissal visible");
  assert.match(markup, /type="submit"/, "Confirmation requires submit");
  assert.match(markup, /type="button"/, "Dismiss does not submit");
  assert.match(markup, /I cannot meet the schedule/, "Reason remains visible for review");
}
console.log("PASS: Hustler booking response queue, deliberate confirmation, and existing backend state gates");
