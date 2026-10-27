#!/usr/bin/env node
// UX010: exercise the REAL compiled Nest service with isolated, fake Prisma
// records. Never read or write an AWS, Neon, production or staging database.
require("reflect-metadata");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const { CreatorActivationService } = require("../../apps/api/dist/creator-activation/creator-activation.service.js");
const controller = fs.readFileSync("apps/api/src/creator-activation/creator-activation.controller.ts", "utf8");
const proxy = fs.readFileSync("apps/web/lib/api/isolated-web-proxy.ts", "utf8");
const policy = fs.readFileSync("apps/api/src/staging-request-policy.ts", "utf8");
const account = fs.readFileSync("apps/web/app/account/page.tsx", "utf8");
const page = fs.readFileSync("apps/web/app/grow/page.tsx", "utf8");

assert.match(controller, /@UseGuards\(AuthGuard\)/, "Activation must require a real session");
assert.match(controller, /@CurrentIdentity\(\) identity: AuthIdentity/, "Identity must come from AuthGuard");
assert.match(proxy, /route === creatorActivationRead/, "Cloudflare proxy allows exact read route");
assert.match(policy, /const ordinaryRead =[^\n]+creator-activation/, "Backend allows exact read route");
assert.match(account, /href="\/grow"/, "Account links to workspace");
assert.match(page, /getCreatorActivation\(\)/, "Workspace consumes owner-scoped read API");
assert.doesNotMatch(controller, /@Post\(|@Put\(|@Patch\(|@Delete\(/, "Activation must never expose writes");

const client = {
  id: "client-1", username: "client-proof", displayName: "Test Client",
  capabilities: [{ capability: "CLIENT", status: "ACTIVE" }],
  professionalProfile: { id: "client-profile", status: "DRAFT" }
};
const hustler = {
  id: "hustler-2", username: "hustler-proof", displayName: "Test Hustler",
  capabilities: [
    { capability: "CLIENT", status: "ACTIVE" },
    { capability: "HUSTLER", status: "ACTIVE" }
  ],
  professionalProfile: { id: "hustler-profile", status: "PUBLISHED" }
};
const records = {
  "client-profile": [
    { id: "client-post", status: "PUBLISHED", caption: "Shared an experience",
      publishedAt: new Date(), media: [{ id: "media1" }],
      serviceAttachments: [{ serviceId: "someone-elses-public-offer" }],
      productAttachments: [] }
  ],
  "hustler-profile": [
    { id: "hustler-post", status: "PUBLISHED", caption: "Professional skill demonstrated",
      publishedAt: new Date(), media: [{ id: "media2" }],
      serviceAttachments: [{ serviceId: "published-offer" }],
      productAttachments: [] },
    { id: "hustler-draft", status: "DRAFT", caption: "Upcoming work",
      publishedAt: null, media: [], serviceAttachments: [], productAttachments: [] }
  ]
};
const queried = [];
const prisma = {
  user: {
    async findUnique({ where }) {
      queried.push(["identity", where.authSubject]);
      return where.authSubject === "client-session" ? client
        : where.authSubject === "hustler-session" ? hustler : null;
    }
  },
  post: {
    async findMany({ where }) {
      queried.push(["posts", where.professionalProfileId]);
      return records[where.professionalProfileId] || [];
    }
  },
  service: {
    async count({ where }) {
      queried.push(["services", where.professionalProfileId]);
      assert.equal(where.professionalProfileId, hustler.professionalProfile.id);
      assert.equal(where.status, "PUBLISHED");
      return 1;
    }
  },
  product: {
    async count({ where }) {
      queried.push(["products", where.professionalProfileId]);
      assert.equal(where.professionalProfileId, hustler.professionalProfile.id);
      return 0;
    }
  },
  booking: {
    async count({ where }) {
      queried.push(["bookings", where.hustlerUserId]);
      assert.equal(where.hustlerUserId, hustler.id);
      assert.equal(where.status, "COMPLETED");
      return 2;
    }
  }
};
const service = new CreatorActivationService(prisma);
(async () => {
  const a = await service.mine({ subject: "client-session" });
  assert.equal(a.readOnly, true);
  assert.equal(a.identity.hustlerActive, false);
  assert.equal(a.identity.professionalProfilePublished, false);
  assert.equal(a.counts.publishedPosts, 1, "Client-authored posts are public (ADR-0027)");
  assert.equal(a.counts.linkedPublishedPosts, 1, "Client may refer to public offers");
  assert.equal(a.counts.publishedServices, 0);
  assert.equal(a.counts.completedBookings, 0);
  assert.equal(a.recentPosts[0].id, "client-post");
  assert.equal(queried.filter(q => q[0] === "services" || q[0] === "products" || q[0] === "bookings").length, 0,
    "Client-only activity must not trigger Hustler commerce reads");

  const b = await service.mine({ subject: "hustler-session" });
  assert.equal(b.identity.professionalProfilePublished, true);
  assert.equal(b.counts.posts, 2);
  assert.equal(b.counts.drafts, 1);
  assert.equal(b.counts.publishedPosts, 1);
  assert.equal(b.counts.linkedPublishedPosts, 1);
  assert.equal(b.counts.publishedServices, 1);
  assert.equal(b.counts.publishedProducts, 0);
  assert.equal(b.counts.completedBookings, 2);
  assert.ok(b.recentPosts.every(p => p.id !== "client-post"), "No cross-account posts");
  assert.ok(a.recentPosts.every(p => p.id !== "hustler-post"), "No cross-account posts");

  await assert.rejects(() => service.mine({ subject: "stranger" }), e => e.getStatus?.() === 404);
  assert.equal(queried.filter(q => q[0] === "posts").length, 2,
    "Unknown identity must not touch private content");
  console.log("PASS: UX010 real activation service, Client social authorship, Hustler commerce, completed bookings, session isolation and no writes");
})().catch(e => { console.error(e); process.exitCode = 1; });
