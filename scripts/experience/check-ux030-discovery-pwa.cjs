#!/usr/bin/env node
"use strict";
const fs=require("node:fs");
const assert=require("node:assert/strict");
const app=fs.readFileSync("apps/web/app/layout.tsx","utf8");
const globals=fs.readFileSync("apps/web/app/globals.css","utf8");
const page=fs.readFileSync("apps/web/app/home/page.tsx","utf8");
const css=fs.readFileSync("apps/web/app/home/page.module.css","utf8");
const nav=fs.readFileSync("apps/web/components/navigation/hustle-mobile-nav.tsx","utf8");
// The isolated preview alone draws a top status/inset banner.
assert.match(app,/h-aws-preview-banner/);
assert.match(globals,/\.h-aws-preview-banner\{position:relative/);
assert.match(globals,/body:has\(> \.h-aws-preview-banner\):has\(main\.h-discover-immersive\)\{/);
assert.match(globals,/--discover-top-safe-area:0px/);
assert.match(globals,/body:has\(> \.h-aws-preview-banner\) main\.h-discover-immersive\{/);
assert.match(globals,/height:100%!important/);
assert.match(css,/var\(--discover-top-safe-area,env\(safe-area-inset-top,0px\)\)/);
assert.match(css,/\.mediaSlide \.mediaImage\{object-fit:contain/);
assert.match(css,/\.mediaSlide \.mediaBackdrop\{display:block\}/);
assert.match(page,/item\.creator\.displayName\?\.trim\(\) \|\| "Hustle creator"/);
assert.match(page,/creatorHref \? <Link/);
assert.match(page,/aria-label=\{\x60Creator: \$\{creatorLabel\}\x60\}/);
assert.doesNotMatch(page,/item\.creator\.username \?\? "user"/);
assert.doesNotMatch(page,/creatorHref = .*: "\/home"/);
// Preserve genuine post actions, engagement and navigation.
assert.match(page,/await likePost\(item\.post\.id\)/);
assert.match(page,/await followUser\(item\.creator\.id\)/);
assert.match(page,/className=\{styles\.opportunityDock\}/);
assert.match(page,/captureFeedEvent\(\{\s*name: "feed\.view"/);
assert.match(nav,/href: "\/home", label: "Home"/);
assert.match(nav,/href: "\/search", label: "Explore"/);
console.log("PASS UX030: AWS-only installed layout, uncropped published photos, real creator identity and working feed events.");
