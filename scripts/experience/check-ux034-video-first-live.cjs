#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const read = p => fs.readFileSync(p,"utf8");
const live = read("apps/web/app/live/page.tsx");
const room = read("apps/web/app/live/[liveId]/page.tsx");
const roomCss = read("apps/web/app/live/live.module.css");
const preview = read("apps/web/components/live/live-preview-card.tsx");
const previewCss = read("apps/web/components/live/live-preview-card.module.css");
const home = read("apps/web/app/home/page.tsx");
const homeCss = read("apps/web/app/home/page.module.css");
const globals = read("apps/web/app/globals.css");
const realMedia = read("apps/web/components/live/native-live-viewer.tsx");
const allow = read("apps/api/src/staging-request-policy.ts");
// LIVE Discovery is ONLY genuine active broadcasts, with a video-first
// snap stage, shared with normal Discovery. It is not a marketing dashboard.
assert.match(live,/getActiveLiveSessions\(30\)/);
assert.match(live,/sessions\.filter\(s=>s\.status === "LIVE"\)/);
assert.match(live,/data-hustle-live-previews="true"/);
assert.match(live,/<LivePreviewCard session=\{item\}/);
assert.doesNotMatch(live,/livePreviewIntro|Watch the work|Live sessions available|Active now/);
assert.match(roomCss,/\.livePreviewFeed\{max-width:700px;margin:auto/);
assert.match(roomCss,/scroll-snap-type:y mandatory/);
assert.match(globals,/body:has\(main\[data-hustle-live-previews="true"\]\)/);
assert.match(home,/getActiveLiveSessions\(12\)/);
assert.match(home,/blendedFeed\.map\(\(entry, index\)/);
assert.match(home,/<LivePreviewCard session=\{entry\.live\} context="discovery"/);
// TikTok-like Product/Service tile reuses the REAL post attachments and routes
// into the already-implemented product/service quick view.
assert.match(preview,/session\.pinnedProduct \?\? session\.pinnedService/);
assert.match(preview,/formatLiveMoney\(offer\.priceMinor, offer\.currency\)/);
assert.match(preview,/href=\{\x60\/live\/\$\{encodeURIComponent\(session\.id\)\}\x60\}/);
assert.match(preview,/muted autoPlay playsInline loop preload="metadata"/);
assert.match(previewCss,/\.pinnedCopy/);
assert.match(previewCss,/\.pinnedAction/);
assert.doesNotMatch(preview,/createLiveComment|onClick=|placeholder=.*Say something/);
assert.match(home,/className=\{styles\.inlineOfferCard\} aria-label="Product attached to this post"/);
assert.match(home,/className=\{styles\.inlineOfferCard\} aria-label="Service attached to this post"/);
assert.match(home,/formatProductPrice\(item\.products\[0\]\)/);
assert.match(home,/formatServicePrice\(item\.services\[0\]\)/);
assert.match(home,/sourcePostId=\{item\.post\.id\}/);
assert.match(homeCss,/\.inlineOfferCard/);
assert.match(homeCss,/\.inlineOfferCard \.directOffer/);
// Full LIVE is the full-height VIDEO stage with real floating comments,
// pinned commerce, host, audience and share. Not separate cards or columns.
assert.match(room,/data-hustle-live-room="true"/);
assert.match(room,/className=\{styles\.roomVideo\}/);
assert.match(room,/className=\{styles\.roomHeader\}/);
assert.match(room,/className=\{styles\.roomComments\}/);
assert.match(room,/className=\{styles\.roomOffer\}/);
assert.match(room,/className=\{styles\.roomComposer\}/);
assert.match(room,/className=\{styles\.roomWatching\}/);
assert.match(room,/aria-label="Close Live"/);
assert.match(room,/OfferQuickView/);
assert.match(room,/comments\.map\(comment =>/);
assert.match(room,/onSubmit=\{submitComment\}/);
assert.match(room,/onClick=\{\(\) => void share\(\)\}/);
assert.match(room,/session\.media\.nativeBroadcasting && !isolatedWebMode/);
assert.match(room,/Live chat isn't enabled in AWS test/);
assert.match(roomCss,/\.immersiveRoom\{position:fixed;inset:0/);
assert.match(roomCss,/\.roomGradient\{z-index:1;pointer-events:none/);
assert.match(roomCss,/\.roomBottom\{position:absolute/);
assert.match(roomCss,/\.roomVideo \.remoteVideo\{height:100%;object-fit:cover/);
assert.match(realMedia,/getLiveViewerCredential\(liveId\)/);
assert.match(allow,/const livePublicRead/);
// No new staging LiveKit stream token, hosting, money or payment permissions.
assert.doesNotMatch(allow,/\/api\/v1\/live\/.*publish-token.*test\(path\)/);
assert.doesNotMatch(allow,/\/api\/v1\/live\/.*view-token.*test\(path\)/);
assert.doesNotMatch(room,/Math\.random\(|mockComment|fakeViewers/);
console.log("PASS UX034: reference-inspired LIVE previews, post attachments and immersive room; no fake activity or financial policy changes.");
