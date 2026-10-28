#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const { auditMediaInventory, BUCKET } = require("./ux011-media-orphan-audit.cjs");

const author="client-user", post="client-post";
const keep = `media/${author}/${post}/12345678-1234-1234-1234-123456789abc`;
const stale = `media/${author}/${post}/87654321-4321-4321-4321-abcdefabcdef`;
const recent = `media/${author}/${post}/11111111-2222-3333-4444-555555555555`;
const pending = `pending/${author}/${post}/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee`;
const input = {
  bucket: BUCKET,
  asOf: "2026-10-28T12:00:00Z",
  inventoryComplete: true,
  s3Objects: [
    { Key: keep, LastModified: "2026-10-01T12:00:00Z", Size: 10 },
    { Key: stale, LastModified: "2026-10-01T12:00:00Z", Size: 20 },
    { Key: recent, LastModified: "2026-10-28T11:59:00Z", Size: 30 },
    { Key: pending, LastModified: "2026-10-01T12:00:00Z", Size: 40 },
    { Key: "another-bucket/anything", LastModified: "2026-10-01T12:00:00Z", Size: 50 }
  ],
  postMedia: [{ storageKey: keep }]
};
const report = auditMediaInventory(input);
assert.equal(report.protectedReferences, 1);
assert.equal(report.pendingLifecycle, 1);
assert.equal(report.recentUnreferenced, 1);
assert.equal(report.invalidOrUnrecognized, 1);
assert.deepEqual(report.manualReviewCandidates, [{
  key: stale, size: 20, lastModified: "2026-10-01T12:00:00Z"
}]);
assert.equal(report.deletionPerformed, false);
assert.throws(() => auditMediaInventory({...input, inventoryComplete: false}), /partial/);
assert.throws(() => auditMediaInventory({...input, bucket: "production"}), /staging/);
assert.throws(() => auditMediaInventory({...input, asOf: "invalid"}), /timestamp/);
assert.deepEqual(auditMediaInventory({
  ...input,
  s3Objects: input.s3Objects.filter(x=>x.Key===keep),
  postMedia: [{storageKey:keep}]
}).manualReviewCandidates, []);
console.log("PASS: UX011 read-only orphan inventory excludes current references, pending lifecycle and new/untrusted keys; refuses incomplete inventory and never deletes");
