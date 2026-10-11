#!/usr/bin/env node
// Source-level UI guardrails; no uploads, mutations, credentials or live broadcast.
// CI is not a substitute for signed-in browser and actual media transport checks.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = (file) => fs.readFileSync(path.join(__dirname,"../..",file),"utf8");
const post = read("apps/web/app/posts/post-editor.tsx");
const profile = read("apps/web/app/professional-profile/page.tsx");
const storyCreate = read("apps/web/app/stories/create/page.tsx");
const storyViewer = read("apps/web/app/stories/[storyId]/page.tsx");
const liveCreate = read("apps/web/app/live/create/page.tsx");
const liveControl = read("apps/web/app/live/[liveId]/control/page.tsx");
const liveViewer = read("apps/web/app/live/[liveId]/page.tsx");
const checks = [
  [!profile.includes("HUSTLER · VERIFIED"),"No fabricated Hustler verified badge"],
  [profile.includes('const contactVerified = Boolean(account?.emailVerified || account?.phoneVerified)'),"Contact badge is backed by account fields"],
  [profile.includes('contactVerified && <span>CONTACT VERIFIED'),"Display verified contact label conditionally"],
  [profile.includes('HUSTLER · ACTIVE'),"Capability status separate from contact status"],
  [profile.includes('kind="error"'),"Professional profile retry"],
  [profile.includes('creatorFlow'),"Real creator storefront path"],
  [post.includes('Publish checklist:'),"Clear post readiness"],
  [post.includes('mediaCount === 0'),"No media-free publish claim"],
  [post.includes('creatorNav'),"Post/Story/Live share navigation"],
  [storyCreate.includes('URL.createObjectURL(mediaFile)'),"Real local media preview"],
  [storyCreate.includes('URL.revokeObjectURL(objectUrl)'),"Preview object URL is released"],
  [storyCreate.includes('mediaValidation'),"Image/video type and size validation"],
  [storyCreate.includes('disabled={!canSubmit || submitting}'),"Invalid Story cannot publish"],
  [storyCreate.includes('role="alert"'),"Story upload errors accessible"],
  [storyViewer.includes('loadedStory?.id === params?.storyId'),"No previous Story shown on route change"],
  [storyViewer.includes('setReplies([])'),"Previous private Story replies cleared"],
  [storyViewer.includes('current?.id === storyId'),"Story view count applied only to current Story"],
  [liveCreate.includes('Creating a room does not start broadcasting'),"Live room is not a broadcast"],
  [liveControl.includes('!mediaConnected && !session.playbackUrl'),"Blank Live session cannot start"],
  [liveControl.includes('Save the changed playback URL before starting'),"Saved playback required"],
  [liveControl.includes('hostChecklist'),"True stream connection status presented"],
  [liveControl.includes('loadedSession?.id === liveId'),"No stale control session identity"],
  [liveViewer.includes('loadedSession?.id === liveId'),"No stale viewer session identity"],
];
for(const [ok,description] of checks) assert.ok(ok,description);
console.log("Creator/Stories/Live/Profile UX source contract OK ("+checks.length+" checks).");
