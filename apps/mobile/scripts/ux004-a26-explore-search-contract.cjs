#!/usr/bin/env node
/**
 * UX004-A2.6: exercise real local Explore search and verify screen integration.
 * Static/UI contracts and Node tests do NOT establish Android visual QA.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");

const mobile = path.resolve(__dirname, "..");
const root = path.resolve(mobile, "../..");
const read = p => fs.readFileSync(path.join(mobile, p), "utf8");
const readRoot = p => fs.readFileSync(path.join(root, p), "utf8");
const demo = read("src/experience/DemoExperience.tsx");
const helperPath = path.join(mobile, "src/ux004/discovery/demoExploreSearch.ts");
const source = fs.readFileSync(helperPath, "utf8");
const output = ts.transpileModule(source, {compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true
}, reportDiagnostics: true});
assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const loaded = new Module(helperPath, module);
loaded.filename = helperPath;
loaded.paths = Module._nodeModulePaths(path.dirname(helperPath));
loaded._compile(output.outputText, helperPath);
const {filterDemoExplorePosts} = loaded.exports;

function check(name, fn) { fn(); console.log("PASS: " + name); }

/** Parse only literal real demo POST fixtures; do not execute React Native. */
function actualPosts() {
  const ast = ts.createSourceFile("DemoExperience.tsx", demo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let fixture;
  function walk(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "POSTS") {
      fixture = node.initializer;
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.ok(fixture, "POSTS missing");
  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isObjectLiteralExpression(node)) {
      const obj = {};
      for (const entry of node.properties) {
        assert.ok(ts.isPropertyAssignment(entry));
        assert.ok(ts.isIdentifier(entry.name) || ts.isStringLiteral(entry.name));
        obj[entry.name.text] = literal(entry.initializer);
      }
      return obj;
    }
    throw new Error("Unexpected fixture syntax: " + ts.SyntaxKind[node.kind]);
  }
  return literal(fixture);
}
const posts = actualPosts();
const ids = items => items.map(p => p.id);

check("Real four fixtures retain original order and no matching query returns all", () => {
  assert.deepEqual(ids(posts), ["p1", "p2", "p3", "p4"]);
  const before = JSON.stringify(posts);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "", "All")), ids(posts));
  assert.deepEqual(ids(filterDemoExplorePosts(posts, " \n\t ", "All")), ids(posts));
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "something not present", "All")), []);
  assert.equal(JSON.stringify(posts), before);
});

check("A work-specific phrase in caption, artwork or product copy finds correct fictional provider", () => {
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "two-piece", "All")), ["p1"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "fade", "All")), ["p2"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "signature spice", "All")), ["p3"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "portrait", "All")), ["p4"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "fit your story", "All")), ["p1"]);
});

check("Search still understands names, profession, offer, location and handle", () => {
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "mira", "All")), ["p1"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "BARBER", "All")), ["p2"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "chef.amara", "All")), ["p3"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "surulere", "All")), ["p4"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "premium haircut", "All")), ["p2"]);
});

check("All search terms must match across content fields; whitespace and case are benign", () => {
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "  SHARP \t FADE  ", "All")), ["p2"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "PORTRAIT edits", "All")), ["p4"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "sketch outfit", "All")), ["p1"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "fade portrait", "All")), []);
});

check("Skill chips intersect search and never pretend to use actual geolocation", () => {
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "", "Food")), ["p3"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "fade", "Beauty")), ["p2"]);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "fade", "Food")), []);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "", "not-a-category")), []);
  assert.deepEqual(ids(filterDemoExplorePosts(posts, "Lekki", "Fashion")), ["p1"]);
});

check("Explore UI wires real selector, readable proof-of-work snippet and result count", () => {
  assert.match(demo, /import \{ filterDemoExplorePosts \} from "\.\.\/ux004\/discovery\/demoExploreSearch"/);
  assert.match(demo, /useMemo\(\(\) => filterDemoExplorePosts\(POSTS, search, category\), \[category, search\]\)/);
  assert.match(demo, /onChangeText=\{setSearch\}/);
  assert.match(demo, /accessibilityLabel="Search fictional work and professionals"/);
  assert.match(demo, /accessibilityLiveRegion="polite"/);
  assert.match(demo, /visibleExplore\.length} fictional \{visibleExplore\.length === 1 \? "result" : "results"}/);
  assert.match(demo, /<Text style=\{styles\.exploreWorkPreview\} numberOfLines=\{2\}>\{post\.caption\}<\/Text>/);
  assert.match(demo, /onPress=\{\(\) => openWorkInFeed\(post\.id\)\}/);
  assert.match(demo, /onPress=\{\(\) => open\("creator", post\)\}/);
});

check("Both clearing paths are accessible; category and query survive normal tab changes", () => {
  assert.match(demo, /const hasExploreFilters = Boolean\(search\.trim\(\)\) \|\| category !== "All"/);
  assert.match(demo, /function resetExploreFilters\(\) \{\s*setSearch\(""\);\s*setCategory\("All"\);/);
  assert.match(demo, /accessibilityLabel="Clear Explore search"/);
  assert.match(demo, /onPress=\{\(\) => setSearch\(""\)\}/);
  assert.match(demo, /accessibilityLabel="Clear Explore search and filters"/);
  assert.match(demo, /onPress=\{resetExploreFilters\}/);
  assert.match(demo, /searchClearTarget: \{ minWidth: layout\.minTapTarget, minHeight: layout\.minTapTarget/);
  assert.match(demo, /exploreResetTarget: \{ minHeight: layout\.minTapTarget/);
  assert.match(demo, /onPress=\{\(\) => setCategory\(cat\)\}/);
  assert.doesNotMatch(demo, /setSearch\(""\);\s*setScreen\(destination\)/);
});

check("Prior A2 slices and offline/no-payment/owner Expo gates remain unchanged", () => {
  for (const feature of [
    "const orderedComments = orderDemoComments(currentComments)",
    "selectSavedPosts(POSTS, saves, selectedCollection)",
    "onArtworkTap(post.id)", "<FeedOfferAttachment",
    'openWorkInFeed(current.id)', 'ILLUSTRATED DEMO',
    "Shopping and checkout are disabled in this demo",
    "No real availability is checked and no booking will be created",
    "OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS"
  ]) assert.ok(demo.includes(feature), feature);
  for (const text of [demo, source]) {
    for (const banned of [/\bfetch\s*\(/, /\baxios\./, /\bcreateClient\s*\(/, /\bmobileApi\./, /\binitializePayment\s*\(/]) {
      assert.doesNotMatch(text, banned, "Offline mode must not introduce actual network or commerce");
    }
  }
  const ci = readRoot(".github/workflows/mobile-cloud-validation.yml");
  const manual = readRoot(".github/workflows/hustle-offline-android-demo.yml");
  for (const suffix of ["a21-feed", "a22-social", "a23-offer", "a24-integration", "a25-explore-work", "a26-explore-search"]) {
    const command = "node apps/mobile/scripts/ux004-" + suffix + "-contract.cjs";
    assert.ok(ci.includes(command), "Missing Mobile CI contract: " + command);
    assert.ok(manual.includes(command), "Missing manual preflight: " + command);
  }
  assert.match(manual, /workflow_dispatch:/);
  assert.match(manual, /if: inputs\.approve_free_demo_build == true/);
  assert.ok(manual.indexOf("ux004-a26-explore-search-contract.cjs") < manual.indexOf("eas build --platform android"));
  const qa = readRoot("Knowledge/QA/HUSTLE_UX004_A26_EXPLORE_SEARCH.md");
  assert.match(qa, /Device acceptance: PENDING/);
  assert.match(qa, /No Expo APK/);
});
console.log("UX004-A2.6 content discovery contract PASS; no Android/phone acceptance claimed.");
