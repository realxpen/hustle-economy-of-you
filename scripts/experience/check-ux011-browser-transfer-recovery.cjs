#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

const source = fs.readFileSync("apps/web/lib/post-media-upload.ts", "utf8");
const editor = fs.readFileSync("apps/web/app/posts/post-editor.tsx", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

class FakeFormData {
  constructor() { this.fields = []; }
  append(name, value, filename) { this.fields.push({ name, value, filename }); }
}
class FakeXHR {
  static mode = "success";
  static current = null;
  constructor() { this.upload = {}; FakeXHR.current = this; this.status = 0; }
  open(method, url) { this.method = method; this.url = url; }
  send(form) {
    this.form = form;
    if (FakeXHR.mode === "hold") return;
    if (this.upload.onprogress) this.upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 });
    if (FakeXHR.mode === "network") this.onerror?.();
    else if (FakeXHR.mode === "timeout") this.ontimeout?.();
    else {
      this.status = FakeXHR.mode === "success" ? 204 : Number(FakeXHR.mode);
      this.onload?.();
    }
  }
  abort() { this.onabort?.(); }
}
const moduleObject = { exports: {} };
vm.runInNewContext(compiled, {
  module: moduleObject, exports: moduleObject.exports,
  require: spec => {
    if (spec === "./auth/isolated-web-auth") return { isolatedWebMode: true };
    if (spec === "./api/authenticated-fetch") return { authenticatedFetch: () => { throw Error("Forbidden live network"); } };
    throw Error("Unexpected import " + spec);
  },
  XMLHttpRequest: FakeXHR, FormData: FakeFormData,
  AbortController, DOMException, URL, Promise, Date, Error, console
}, { filename: "post-media-upload.ts" });
const lib = moduleObject.exports;
const file = { name: "sample.jpg", size: 1200, type: "image/jpeg" };
const ticket = {
  uploadUrl: "https://hustle-ux011-isolated-media-707859598737-eu-west-2.s3.eu-west-2.amazonaws.com/",
  fields: {
    key: "pending/test-user/test-post/11111111-2222-3333-4444-555555555555",
    "Content-Type": "image/jpeg",
    Policy: "not-a-real-policy",
    "X-Amz-Signature": "fake-signature"
  },
  receipt: "fixture-signed-receipt",
  expiresInSeconds: 300,
  contentType: "image/jpeg",
  size: 1200,
  maxBytes: 8_000_000
};

async function attempt(mode) {
  FakeXHR.mode = mode;
  const updates = [];
  const task = lib.transferFileToPrivateStaging(file, ticket, pct => updates.push(pct), new AbortController().signal);
  return { task, updates };
}

(async () => {
  assert.equal(lib.isStagingTransferTicketFresh(ticket, 1000, 266_000), true);
  assert.equal(lib.isStagingTransferTicketFresh(ticket, 1000, 271_000), false);
  assert.equal(lib.isStagingTransferTicketFresh(ticket, 1000, 301_000), false);
  assert.equal(lib.isStagingTransferTicketFresh(ticket, 1000, 999), false);

  const good = await attempt("success");
  await good.task;
  assert.deepEqual(good.updates, [99], "Percent must not report 100 before server verification");
  assert.equal(FakeXHR.current.timeout, 270_000);
  assert.equal(FakeXHR.current.method, "POST");
  assert.deepEqual(FakeXHR.current.form.fields.map(f => f.name).at(-1), "file");

  for (const [mode,kind,phrase] of [
    ["network","network","Check the upload before retrying"],
    ["timeout","timeout","Check the upload before retrying"],
    ["0","network","Check the upload before retrying"],
    ["403","refused","HTTP 403"],
    ["413","refused","HTTP 413"],
    ["503","refused","HTTP 503"]
  ]) {
    const run = await attempt(mode);
    await assert.rejects(run.task, e => {
      assert.equal(e.code, kind);
      assert.match(e.message, new RegExp(phrase));
      assert.match(e.diagnostic, /^UX011\/direct-S3; event=xhr-(error|timeout|status-zero|http); elapsed=(under-10s|10-60s|60-180s|over-180s); ready=(unknown|[0-4]); HTTP=(opaque|[1-5][0-9]{2}); connectivity=(unknown|offline-reported|online-reported)$/);
      assert.doesNotMatch(e.diagnostic, /sample\.jpg|fake-signature|not-a-real-policy|fixture-signed-receipt|pending\/test-user|amazonaws|hustle-ios-pwa/i);
      assert.doesNotMatch(e.message, /fake-signature|not-a-real-policy|fixture-signed-receipt|pending\/test-user/);
      return true;
    }, "Error " + mode + " must be classified without leaking policy or receipt");
  }
  FakeXHR.mode = "hold";
  const cancelled = new AbortController();
  const task = lib.transferFileToPrivateStaging(file, ticket, () => {}, cancelled.signal);
  cancelled.abort();
  await assert.rejects(task, e => e.name === "AbortError");

  await assert.rejects(lib.transferFileToPrivateStaging(file, {
    ...ticket, uploadUrl: "https://unapproved-s3.example.com/"
  },()=>{},new AbortController().signal), /Unexpected staging media upload destination/);
  await assert.rejects(lib.transferFileToPrivateStaging(file, {
    ...ticket, size: 1300
  },()=>{},new AbortController().signal), /authorization does not match/);

  assert.match(editor,/setPendingTransfer\(\{\s*file: selectedFile, postId, ticket, authorizedAtMs: Date\.now\(\)/,
    "Save signed receipt before sending bytes");
  assert.match(editor,/Check earlier upload first/, "Explicit verification prior to retransmission");
  assert.match(editor,/retryCount: 0, checked: false/, "Fresh ticket has no prior retries");
  assert.match(editor,/previousAttempt && !previousAttempt\.checked/, "Owner must verify ambiguous result first");
  assert.match(editor,/reason instanceof AuthenticatedApiError/, "Only typed HTTP status may authorize retry");
  assert.match(editor,/reason\.status === 404 && reason\.message === "Pending private media bytes not received"/,
    "Only a specific authenticated S3-missing response may unlock retry");
  assert.match(editor,/checked: confirmedMissing/, "All other verification failures stay blocked");
  assert.doesNotMatch(editor,/checked: true/, "Never mark arbitrary API verification errors as checked");
  assert.match(editor,/previousAttempt\.retryCount >= 1/, "At most one same-key retry per ticket");
  assert.match(editor,/retryCount: recoverable\.retryCount \+ 1, checked: false/, "Count the same-key retry");
  assert.match(editor,/setPendingConfirmation\(\{ file, postId: draftId, receipt \}\)/, "After confirm, failed refresh cannot repeat transfer");
  assert.match(editor,/reason instanceof PrivateMediaTransferError/, "Display safe typed diagnostic");
  assert.doesNotMatch(editor,/console\.(log|warn|info|error)\([^\n]*(ticket|receipt|selectedFile)/, "Never log sensitive upload data");
  assert.match(editor,/checkPreviousTransfer\(\)/, "Check button is actionable");
  assert.match(editor,/isStagingTransferTicketFresh\(/, "Expired POST policy must be replaced");
  assert.match(editor,/const ticket = recoverable\?\.ticket \?\?/, "Fresh retry must use same signed key");
  assert.match(editor,/await commitUploadedFile\(attempt\.postId, attempt\.ticket\.receipt, attempt\.file\)/,
    "Owner action must verify the same receipt, without retransferring");
  assert.match(editor,/setPendingTransfer\(null\)/, "After success or cancel, recovery token is cleared");
  assert.doesNotMatch(editor,/localStorage\.setItem\([^\n]*(receipt|ticket|pendingTransfer)/,
    "Never persist signed receipts to device storage");

  console.log("PASS: UX011 Safari transport categorization, redacted diagnostic, check-first single retry, safe draft refresh");
})().catch(e=>{console.error(e);process.exitCode=1;});
