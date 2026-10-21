#!/usr/bin/env node
/**
 * UX004-A2.4 cumulative offline Feed/social integration contract.
 * Executes actual pure helpers against literal fixtures extracted from the
 * current demo, and checks the React Native wiring as source contracts.
 * NOT a renderer, accessibility audit, Waydroid test, or device sign-off.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const mobile = path.resolve(__dirname, "..");
const repo = path.resolve(mobile, "../..");
const read = p => fs.readFileSync(path.join(mobile, p), "utf8");
const rootRead = p => fs.readFileSync(path.join(repo, p), "utf8");
const demo = read("src/experience/DemoExperience.tsx");
const attachment = read("src/ux004/feed/FeedOfferAttachment.tsx");
const mobileCI = rootRead(".github/workflows/mobile-cloud-validation.yml");
const manualBuild = rootRead(".github/workflows/hustle-offline-android-demo.yml");
const qa = rootRead("Knowledge/QA/HUSTLE_UX004_A24_INTEGRATION_QA.md");

function check(label, fn) {
  fn();
  console.log("PASS: " + label);
}

/** Load the real package-free TS pure selectors; no mocked replacement code. */
function loadPureModule(relative) {
  const filename = path.join(mobile, relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      strict: true,
    },
    reportDiagnostics: true,
  });
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
  const loaded = new Module(filename, module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output.outputText, filename);
  return loaded.exports;
}

/**
 * Read literal fixture data from the actual screen without importing
 * React Native or evaluating arbitrary TS expressions.
 */
function readFixture(name) {
  const sourceFile = ts.createSourceFile("DemoExperience.tsx", demo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let initializer;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, walk);
  }
  walk(sourceFile);
  assert.ok(initializer, "Missing fixture " + name);
  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isObjectLiteralExpression(node)) {
      const result = {};
      for (const entry of node.properties) {
        assert.ok(ts.isPropertyAssignment(entry), "Fixture must be a literal object");
        const key = entry.name;
        assert.ok(ts.isIdentifier(key) || ts.isStringLiteral(key));
        result[key.text] = literal(entry.initializer);
      }
      return result;
    }
    throw new Error("Non-literal expression in " + name + ": " + ts.SyntaxKind[node.kind]);
  }
  return literal(initializer);
}

const { orderDemoComments, replyRootId, selectSavedPosts } =
  loadPureModule("src/ux004/feed/demoSocial.ts");
const { getDemoOfferCopy } = loadPureModule("src/ux004/feed/demoOfferCopy.ts");
const posts = readFixture("POSTS");
const initialComments = readFixture("INITIAL_COMMENTS");

check("All four real fictional Feed fixtures have distinct, complete local identities and offers", () => {
  assert.equal(posts.length, 4);
  assert.equal(new Set(posts.map(post => post.id)).size, posts.length);
  assert.equal(new Set(posts.map(post => post.handle)).size, posts.length);
  for (const post of posts) {
    for (const field of ["id", "handle", "name", "profession", "category", "caption", "headline"]) {
      assert.ok(typeof post[field] === "string" && post[field].trim(), post.id + ": " + field);
    }
    assert.ok(["service", "product"].includes(post.offer.kind));
    assert.ok(post.offer.title.trim() && post.offer.price.includes("₦") && post.offer.detail.includes("Sample listing"));
    assert.ok(Number.isInteger(post.likes) && post.likes >= 0);
  }
  assert.equal(posts.filter(post => post.offer.kind === "product").length, 1);
  assert.equal(posts.filter(post => post.offer.kind === "service").length, 3);
});

check("Real initial comments, nested local replies and independent post counts remain ordered", () => {
  const first = posts[0].id;
  const baseline = initialComments[first];
  assert.ok(baseline.length >= 2);
  const original = JSON.stringify(initialComments);
  const rootId = baseline[0].id;
  const replyId = baseline[1].id;
  assert.equal(replyRootId(baseline, replyId), rootId);
  const newReply = { id: "local-reply-a24", handle: "you.demo", body: "Demo reply", parentId: replyRootId(baseline, replyId) };
  const augmented = [...baseline, newReply];
  assert.deepEqual(orderDemoComments(augmented).map(note => note.id), [rootId, replyId, newReply.id]);
  assert.equal(augmented.length, baseline.length + 1);
  assert.equal(initialComments[posts[1].id].length, 1);
  assert.equal(initialComments[posts[3].id].length, 0);
  assert.equal(JSON.stringify(initialComments), original, "Must not mutate initial fixtures");
});

check("Named saves separate posts and restore original feed order without changing source data", () => {
  const saves = {
    [posts[0].id]: ["Inspiration", "Outfit ideas"],
    [posts[1].id]: ["Inspiration"],
    [posts[2].id]: ["Outfit ideas"],
  };
  const snapshot = JSON.stringify(posts);
  assert.deepEqual(selectSavedPosts(posts, saves, "Inspiration").map(p => p.id),
    [posts[0].id, posts[1].id]);
  assert.deepEqual(selectSavedPosts(posts, saves, "Outfit ideas").map(p => p.id),
    [posts[0].id, posts[2].id]);
  assert.deepEqual(selectSavedPosts(posts, saves, null).map(p => p.id),
    [posts[0].id, posts[1].id, posts[2].id]);
  assert.deepEqual(selectSavedPosts(posts, {}, "Inspiration"), []);
  assert.equal(JSON.stringify(posts), snapshot);
});

check("Every actual post selects matching sample copy, never a Book/Buy transaction action", () => {
  for (const post of posts) {
    const copy = getDemoOfferCopy(post.offer.kind);
    assert.equal(copy.badge, post.offer.kind === "service" ? "SAMPLE SERVICE" : "SAMPLE PRODUCT");
    assert.equal(copy.action, post.offer.kind === "service" ? "View service" : "View product");
    assert.match(copy.noTransaction, /Preview only; no (booking|purchase) is made/);
    assert.doesNotMatch(copy.action, /book|shop|buy|pay|checkout/i);
  }
  assert.match(attachment, /accessibilityRole="button"/);
  assert.match(attachment, /accessibilityHint=\{copy\.noTransaction\}/);
  assert.match(attachment, /numberOfLines=\{2\}/);
  assert.match(attachment, /minHeight: layout\.minTapTarget/);
});

check("UI integrates gestures, per-post comments, saves, offers and preserved feed index", () => {
  assert.match(demo, /const visibleFeed = savedOnly \? selectSavedPosts\(POSTS, saves, selectedCollection\) : POSTS/);
  assert.match(demo, /const orderedComments = orderDemoComments\(currentComments\)/);
  assert.match(demo, /setReplyTo\(replyRootId\(currentComments, note\.id\)\)/);
  assert.match(demo, /onSubmitEditing=\{addComment\}/);
  assert.match(demo, /accessibilityRole="checkbox" accessibilityState=\{\{ checked: enabled \}\}/);
  assert.match(demo, /setSelectedCollection\(collection\)/);
  assert.match(demo, /setIndex\(regularFeedIndex\.current\)/);
  assert.match(demo, /if \(!savedOnly\) regularFeedIndex\.current = next/);
  assert.match(demo, /initialScrollIndex=\{Math\.min\(index/);
  assert.match(demo, /getItemLayout=\{\(_, i\) => \(\{ length: pageHeight, offset: pageHeight \* i, index: i \}\)\}/);
  assert.match(demo, /onArtworkTap\(post\.id\)/);
  assert.match(demo, /previousLikes\.includes\(postId\) \? previousLikes : \[\.\.\.previousLikes, postId\]/);
  assert.match(demo, /onPress=\{\(\) => toggleCaption\(post\.id\)\}/);
  assert.match(demo, /<FeedOfferAttachment kind=\{post\.offer\.kind\} title=\{post\.offer\.title\}/);
  assert.match(demo, /onPress=\{\(\) => open\("offer", post\)\}/);
  assert.match(demo, /ILLUSTRATED DEMO · \{post\.category\.toUpperCase\(\)\}/);
  assert.match(demo, /Illustrated sample, not real video/);
});

check("Navigation, Android keyboard/Back and demo-only transaction boundaries remain enforced", () => {
  assert.match(demo, /key=\{\`\$\{savedOnly \? "saved-" \+ selectedCollection : feed\}:\$\{Math\.round\(pageHeight\)\}\`}/);
  assert.match(demo, /onRequestClose=\{requestDismissSheet\}/);
  assert.match(demo, /Keyboard\.isVisible\(\) \|\| keyboardVisible/);
  assert.match(demo, /Keyboard\.dismiss\(\)/);
  assert.match(demo, /\{!keyboardVisible && <FloatingTabBar/);
  assert.match(demo, /OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS/);
  assert.match(demo, /Shopping and checkout are disabled in this demo/);
  assert.match(demo, /No real availability is checked and no booking will be created/);
  assert.match(demo, /Preview request \(not sent\)/);
  assert.match(demo, /Publishing is disabled in the offline preview/);
  assert.match(demo, /Demo profile • No verification, reviews, or completed jobs implied/);
  for (const source of [demo, attachment]) {
    for (const banned of [/\bfetch\s*\(/, /\baxios\b/, /\bcreateClient\s*\(/, /\bmobileApi\b/, /\binitializePayment\s*\(/, /\buseVideoPlayer\b/]) {
      assert.doesNotMatch(source, banned, "An offline demo cannot silently add connected behavior");
    }
  }
});

check("All A2 checks are cloud-gated before separately approved manual Expo builds", () => {
  for (const suffix of ["a21-feed", "a22-social", "a23-offer", "a24-integration"]) {
    const line = "node apps/mobile/scripts/ux004-" + suffix + "-contract.cjs";
    assert.ok(mobileCI.includes(line), line + " missing from Mobile CI");
    assert.ok(manualBuild.includes(line), line + " missing from Expo preflight");
  }
  assert.match(manualBuild, /workflow_dispatch:/);
  assert.match(manualBuild, /if: inputs\.approve_free_demo_build == true/);
  assert.ok(manualBuild.indexOf("ux004-a24-integration-contract.cjs") < manualBuild.indexOf("eas build --platform android"));
  assert.match(qa, /Device acceptance: PENDING/);
  assert.match(qa, /No new Expo APK/);
});

console.log("UX004-A2.4 cumulative contract PASS. Android rendering, gestures and TalkBack remain PENDING.");
