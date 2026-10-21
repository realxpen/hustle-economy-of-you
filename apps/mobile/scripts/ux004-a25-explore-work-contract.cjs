#!/usr/bin/env node
/**
 * UX004-A2.5: real local resolver behavior and static Explore -> Feed wiring.
 * Source/Node tests do not certify Android touch, layout, TalkBack, or scrolling.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "../..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const readRoot = p => fs.readFileSync(path.join(repo, p), "utf8");
const demo = read("src/experience/DemoExperience.tsx");
const helperPath = path.join(root, "src/ux004/discovery/demoWorkRoute.ts");
const helperCode = fs.readFileSync(helperPath, "utf8");
const emitted = ts.transpileModule(helperCode, {compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true
}});
const helper = new Module(helperPath, module);
helper.filename = helperPath;
helper.paths = Module._nodeModulePaths(path.dirname(helperPath));
helper._compile(emitted.outputText, helperPath);
const {findDemoWorkIndex} = helper.exports;

function check(name, fn) { fn(); console.log("PASS: " + name); }

// Extract only the literal real post IDs; do not invent fixture IDs or
// import React Native into Node.
function actualPostIds() {
  const ast = ts.createSourceFile("DemoExperience.tsx", demo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let init;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "POSTS") init = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(init && ts.isArrayLiteralExpression(init), "POSTS must be a literal array");
  return init.elements.map(element => {
    assert.ok(ts.isObjectLiteralExpression(element));
    const prop = element.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText(ast) === "id");
    assert.ok(prop && ts.isPropertyAssignment(prop) && ts.isStringLiteral(prop.initializer));
    return prop.initializer.text;
  });
}
const ids = actualPostIds();

check("All actual fictional Explore post IDs resolve to their exact original Feed indices", () => {
  assert.equal(ids.length, 4);
  const posts = ids.map(id => ({id}));
  const original = JSON.stringify(posts);
  for (let index = 0; index < posts.length; index++) {
    assert.equal(findDemoWorkIndex(posts, ids[index]), index);
  }
  assert.equal(findDemoWorkIndex(posts, "not-in-demo"), null);
  assert.equal(findDemoWorkIndex([], ids[0]), null);
  assert.equal(findDemoWorkIndex(posts, ""), null);
  assert.equal(JSON.stringify(posts), original, "Index lookup must not reorder or change Feed");
});

check("Explore work handoff safely restores the correct normal Feed page", () => {
  assert.match(demo, /import \{ findDemoWorkIndex \} from "\.\.\/ux004\/discovery\/demoWorkRoute"/);
  assert.match(demo, /function openWorkInFeed\(postId: string\) \{/);
  assert.match(demo, /const target = findDemoWorkIndex\(POSTS, postId\);/);
  assert.match(demo, /if \(target === null\) return;/);
  assert.match(demo, /regularFeedIndex\.current = target;/);
  assert.match(demo, /setIndex\(target\);/);
  assert.match(demo, /setSavedOnly\(false\);/);
  assert.match(demo, /setSelectedCollection\(null\);/);
  assert.match(demo, /setSheet\(null\);/);
  assert.match(demo, /setFeed\("For You"\);/);
  assert.match(demo, /setScreen\("Home"\);/);
  assert.match(demo, /initialScrollIndex=\{Math\.min\(index, Math\.max\(0, visibleFeed\.length - 1\)\)\}/);
  assert.match(demo, /getItemLayout=\{\(_, i\) => \(\{ length: pageHeight, offset: pageHeight \* i, index: i \}\)\}/);
});

check("Explore keeps separate accessible profile and See work actions without nesting", () => {
  const start = demo.indexOf("explore.map(post => <View key={post.id} style={styles.exploreCard}>");
  const end = demo.indexOf("</View>)}", start);
  assert.ok(start >= 0 && end > start, "Explore cards must have a separate wrapper");
  const segment = demo.slice(start, end);
  assert.match(segment, /accessibilityLabel=\{"Open sample profile for " \+ post\.name\}/);
  assert.match(segment, /onPress=\{\(\) => open\("creator", post\)\}/);
  assert.match(segment, /accessibilityLabel=\{"See fictional work by " \+ post\.name \+ " in Feed"\}/);
  assert.match(segment, /accessibilityHint="Opens the matching illustrated sample post in For You"/);
  assert.match(segment, /onPress=\{\(\) => openWorkInFeed\(post\.id\)\}/);
  assert.match(segment, /See work ↗/);
  const firstClose = segment.indexOf("</Pressable>");
  const workButton = segment.indexOf('accessibilityLabel={"See fictional work by "');
  assert.ok(firstClose >= 0 && workButton > firstClose, "Do not nest actionable Pressables");
  assert.match(demo, /exploreWorkTarget: \{[^}]*minHeight: layout\.minTapTarget/);
});

check("Creator preview links to its own work only from Explore, preserving offer preview", () => {
  assert.match(demo, /\{screen === "Explore" && <Button title="See sample work in Feed ↗" outline/);
  assert.match(demo, /onPress=\{\(\) => openWorkInFeed\(current\.id\)\}/);
  assert.match(demo, /onPress=\{\(\) => setSheet\("offer"\)\}/);
  assert.match(demo, /Shopping and checkout are disabled in this demo/);
  assert.match(demo, /No real availability is checked and no booking will be created/);
});

check("Cumulative A1/A2 controls, disconnected demo boundaries, and manual Expo approval preserved", () => {
  for (const needle of [
    "onArtworkTap(post.id)", "const orderedComments = orderDemoComments(currentComments)",
    "selectSavedPosts(POSTS, saves, selectedCollection)", "<FeedOfferAttachment",
    "regularFeedIndex.current", "Illustrated sample, not real video",
    "OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS",
    "onRequestClose={requestDismissSheet}", "returnToForYou"
  ]) assert.ok(demo.includes(needle), needle);
  for (const banned of [/\bfetch\s*\(/, /\baxios\./, /\bcreateClient\s*\(/, /\bmobileApi\./, /\binitializePayment\s*\(/, /useVideoPlayer/]) {
    assert.doesNotMatch(demo, banned);
    assert.doesNotMatch(helperCode, banned);
  }
  const ci = readRoot(".github/workflows/mobile-cloud-validation.yml");
  const manual = readRoot(".github/workflows/hustle-offline-android-demo.yml");
  for (const suffix of ["a21-feed", "a22-social", "a23-offer", "a24-integration", "a25-explore-work"]) {
    const command = "node apps/mobile/scripts/ux004-" + suffix + "-contract.cjs";
    assert.ok(ci.includes(command), "Mobile CI missing " + command);
    assert.ok(manual.includes(command), "EAS preflight missing " + command);
  }
  assert.match(manual, /workflow_dispatch:/);
  assert.match(manual, /if: inputs\.approve_free_demo_build == true/);
  assert.ok(manual.indexOf("ux004-a25-explore-work-contract.cjs") < manual.indexOf("eas build --platform android"));
  const qa = readRoot("Knowledge/QA/HUSTLE_UX004_A25_EXPLORE_WORK.md");
  assert.match(qa, /Device acceptance: PENDING/);
  assert.match(qa, /No Expo APK/);
});
console.log("UX004-A2.5 cloud contract PASS; Android interaction and layout acceptance remain PENDING.");
