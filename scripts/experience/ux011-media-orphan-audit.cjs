#!/usr/bin/env node
"use strict";

/**
 * UX011: READ-ONLY reconciliation of a bounded S3 inventory and authoritative
 * Neon PostMedia storageKeys. This does NOT connect to AWS/Neon and NEVER
 * deletes anything. Operators supply inventories through their approved,
 * read-only connectors and review any flagged object before explicit cleanup.
 *
 * Usage: node scripts/experience/ux011-media-orphan-audit.cjs <input.json>
 * Input: {bucket, asOf, s3Objects:[{Key,LastModified,Size}],
 *         postMedia:[{storageKey}], inventoryComplete:true}
 */
const fs = require("node:fs");
const BUCKET = "hustle-ux011-isolated-media-707859598737-eu-west-2";
const MEDIA_KEY = /^media\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}$/;
const PENDING_KEY = /^pending\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}$/;
const MIN_AGE_MS = 48 * 60 * 60_000;

function auditMediaInventory(input) {
  if (!input || input.bucket !== BUCKET || input.inventoryComplete !== true)
    throw new Error("Refusing partial or non-staging S3 inventory");
  const now = Date.parse(input.asOf);
  if (!Number.isFinite(now) || !Array.isArray(input.s3Objects) || !Array.isArray(input.postMedia))
    throw new Error("Missing complete S3/PostMedia inventory or valid asOf timestamp");

  const attached = new Set(input.postMedia.map(row => row.storageKey).filter(Boolean));
  const report = {
    protectedReferences: 0,
    pendingLifecycle: 0,
    manualReviewCandidates: [],
    recentUnreferenced: 0,
    invalidOrUnrecognized: 0,
    deletionPerformed: false
  };
  for (const object of input.s3Objects) {
    const key = object.Key;
    if (typeof key !== "string") throw new Error("Invalid S3 object inventory row");
    if (PENDING_KEY.test(key)) {
      report.pendingLifecycle++;
      continue;
    }
    if (!MEDIA_KEY.test(key)) {
      report.invalidOrUnrecognized++;
      continue;
    }
    if (attached.has(key)) {
      report.protectedReferences++;
      continue;
    }
    const modified = Date.parse(object.LastModified);
    if (!Number.isFinite(modified) || modified > now || !Number.isSafeInteger(object.Size) || object.Size < 0) {
      report.invalidOrUnrecognized++;
      continue;
    }
    if (now - modified < MIN_AGE_MS) {
      report.recentUnreferenced++;
      continue;
    }
    // A candidate is NEVER approval to delete. A concurrent confirm, retries,
    // archived post or delayed DB read can change the conclusion.
    report.manualReviewCandidates.push({ key, size: object.Size, lastModified: object.LastModified });
  }
  return report;
}

module.exports = { auditMediaInventory, BUCKET };

if (require.main === module) {
  const path = process.argv[2];
  if (!path) {
    console.error("Provide an explicit, read-only JSON inventory file; no cloud access is performed.");
    process.exitCode = 2;
  } else {
    const result = auditMediaInventory(JSON.parse(fs.readFileSync(path, "utf8")));
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (result.manualReviewCandidates.length > 0) process.exitCode = 1;
  }
}
