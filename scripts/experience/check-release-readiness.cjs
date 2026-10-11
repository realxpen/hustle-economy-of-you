#!/usr/bin/env node
// Source contracts for safe UI stabilization. Real browser smoke follows
// production build in Foundation CI, and device/signed-in QA remains separate.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(p)=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");
const story=read("apps/web/app/stories/[storyId]/page.tsx");
const browser=read("scripts/responsive/browser-audit.cjs");
const local=read("scripts/responsive/local-smoke.cjs");
const workflow=read(".github/workflows/ci.yml");
const dispatch=read(".github/workflows/responsive-browser-audit.yml");

assert.match(story,/storyIdRef\.current !== requestedStoryId/,"Ignore cross-story reply/reaction responses");
assert.match(story,/setReplies\(\[\]\)/,"Clear private replies during route navigation");
assert.match(story,/setReplyBody\(" "\)|setReplyBody\(""/,"Reset private reply draft between stories");
assert.match(story,/current\?\.id === requestedStoryId/,"Guard story counts before applying mutation");
assert.match(browser,/response\.status\(\)>=400/,"Bad HTTP status must not pass browser audit");
assert.match(browser,/unverified\.length\?"INCOMPLETE"/,"Auth redirects must be incomplete rather than pass");
assert.match(browser,/else if\(unverified\.length\)process\.exitCode=2/,"Release audit must fail closed on incomplete auth coverage");
assert.match(browser,/HUSTLE_AUDIT_REPORT_PATH/,"Release browser evidence must be persisted");
assert.match(local,/127\\\.0\\\.0\\\.1/,"Local smoke must reject remote and production URLs");
assert.match(local,/result\.overflow>3/,"Local smoke checks horizontal overflow");
assert.match(local,/status>=400/,"Local smoke rejects error pages");
assert.match(workflow,/Smoke test local Web at 320/,"Build CI runs actual browser smoke");
assert.match(dispatch,/actions\/upload-artifact@v4/,"Manual viewport audit saves detailed report");
console.log("Release readiness source contract OK (13 privacy/audit guards).");
