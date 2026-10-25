#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"../..",p),"utf8");
const editor=read("apps/web/app/posts/post-editor.tsx");
const feed=read("apps/web/app/home/page.tsx");
const publicPost=read("apps/web/app/posts/[postId]/page.tsx");
const backend=read("apps/api/src/post/post.service.ts");
const feedBackend=read("apps/api/src/feed/feed.service.ts");
// Public discovery is the business model: linking a public service is an
// attributed recommendation, NOT ownership or verified booking feedback.
assert.match(backend,/status: ServiceStatus\.PUBLISHED/);
assert.match(backend,/postServiceAttachment\.upsert/);
assert.match(backend,/status: ProductStatus\.PUBLISHED/);
assert.match(feedBackend,/status: PostStatus\.PUBLISHED/);
assert.match(feedBackend,/userId: \{ not: viewer\.id \}/);
assert.match(editor,/getMyAccount\(\)\.catch\(\(\) => null\)/);
assert.match(editor,/ownerUserId: item\.owner\.id/);
assert.match(editor,/viewerUserId && service\.ownerUserId === viewerUserId \? "Your service"/);
assert.match(editor,/Offered by \$\{service\.owner\} · Public reference/);
assert.match(editor,/viewerUserId && product\.ownerUserId === viewerUserId \? "Your product"/);
assert.match(editor,/Sold by \$\{product\.owner\} · Public reference/);
assert.match(editor,/All published services and products can be discovered by every Hustle account/);
assert.match(editor,/Linking does not transfer ownership or count as a verified review/);
assert.match(editor,/only the separate verified Booking\/Order review flow affects reputation/i);
assert.match(feed,/linked marketplace \{offerCount === 1 \? "offer" : "offers"\}/);
assert.match(feed,/PUBLIC SERVICE · ORIGINAL HUSTLER'S LISTING/);
assert.match(feed,/PUBLIC PRODUCT · ORIGINAL SELLER'S LISTING/);
assert.match(feed,/View provider’s service/);
assert.match(publicPost,/Services and Products linked in this post belong to their original sellers/);
assert.doesNotMatch(feed,/attached \{offerCount === 1 \? "offer" : "offers"\}/);
console.log("PASS: UX009 publicly linked offer attribution, creator-vs-seller distinction, and nonverified post-review safety");
