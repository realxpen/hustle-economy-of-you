#!/usr/bin/env node
/**
 * UX004-A2.8: cumulative content search -> existing local saved collections.
 * Executes the real pure selectors with the actual fictional POST fixtures.
 * UI assertions below cannot certify Android behavior, TalkBack or layout.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const repo = path.resolve(root, "../..");
const demo = fs.readFileSync(path.join(root, "src/experience/DemoExperience.tsx"), "utf8");
const readRoot = p => fs.readFileSync(path.join(repo,p), "utf8");
const ids = posts => posts.map(post => post.id);
function check(name, fn) { fn(); console.log("PASS: " + name); }

function loadModule(relative) {
  const filename = path.join(root, relative);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true
  }, reportDiagnostics:true});
  assert.equal((output.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length,0);
  const loaded = new Module(filename,module);
  loaded.filename = filename;
  loaded.paths = Module._nodeModulePaths(path.dirname(filename));
  loaded._compile(output.outputText,filename);
  return loaded.exports;
}
function actualPosts() {
  const ast = ts.createSourceFile("DemoExperience.tsx",demo,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let fixture;
  function visit(node) {
    if(ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "POSTS") fixture=node.initializer;
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.ok(fixture && ts.isArrayLiteralExpression(fixture), "Fictional POST fixtures missing");
  function value(node) {
    if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node))return node.text;
    if(ts.isNumericLiteral(node))return Number(node.text);
    if(ts.isArrayLiteralExpression(node))return node.elements.map(value);
    if(ts.isObjectLiteralExpression(node)) {
      const obj={};
      for(const p of node.properties) {
        assert.ok(ts.isPropertyAssignment(p));
        assert.ok(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name));
        obj[p.name.text]=value(p.initializer);
      }
      return obj;
    }
    throw Error("Nonliteral fixture: "+ts.SyntaxKind[node.kind]);
  }
  return value(fixture);
}
const posts=actualPosts();
const {selectSavedPosts}=loadModule("src/ux004/feed/demoSocial.ts");
const {filterDemoExplorePosts}=loadModule("src/ux004/discovery/demoExploreSearch.ts");
function explore(query, category, savedOnly, saves) {
  const matched=filterDemoExplorePosts(posts,query,category);
  return savedOnly?selectSavedPosts(matched,saves,null):matched;
}

check("No saved work shows all ordinary Explore results and an empty Saved-only result",()=>{
  assert.deepEqual(ids(posts),["p1","p2","p3","p4"]);
  const initial=JSON.stringify(posts);
  assert.deepEqual(ids(explore("","All",false,{})),ids(posts));
  assert.deepEqual(ids(explore("","All",true,{})),[]);
  assert.deepEqual(ids(explore("fade","Beauty",false,{})),["p2"]);
  assert.deepEqual(ids(explore("fade","Beauty",true,{})),[]);
  assert.equal(JSON.stringify(posts),initial);
});

check("Saving from Explore or Feed yields the same named-collection union, without duplicates",()=>{
  const saves={p1:["Inspiration","Outfit ideas"],p2:["Outfit ideas"],p4:["Inspiration"]};
  const before=JSON.stringify(saves);
  assert.deepEqual(ids(explore("","All",true,saves)),["p1","p2","p4"]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Inspiration")),["p1","p4"]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Outfit ideas")),["p1","p2"]);
  assert.deepEqual(ids(explore("portrait","All",true,saves)),["p4"]);
  assert.deepEqual(ids(explore("fade","Beauty",true,saves)),["p2"]);
  assert.deepEqual(ids(explore("fade","Fashion",true,saves)),[]);
  assert.deepEqual(ids(explore("spice","Food",true,saves)),[]);
  assert.deepEqual(ids(explore("portrait","All",false,saves)),["p4"]);
  assert.equal(JSON.stringify(saves),before);
});

check("Removing the final collection membership immediately hides only the removed work",()=>{
  const saves={p1:["Inspiration"],p2:["Outfit ideas"],p3:["Inspiration"]};
  assert.deepEqual(ids(explore("","All",true,saves)),["p1","p2","p3"]);
  saves.p2=[];
  assert.deepEqual(ids(explore("","All",true,saves)),["p1","p3"]);
  assert.deepEqual(ids(explore("","All",false,saves)),["p1","p2","p3","p4"]);
  saves.p1=["Outfit ideas"];
  assert.deepEqual(ids(explore("","Fashion",true,saves)),["p1"]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Inspiration")),["p3"]);
});

check("Saved-only is an independent checkbox and combines with search/category in the UI",()=>{
  assert.match(demo, /const \[exploreSavedOnly, setExploreSavedOnly\] = useState\(false\)/);
  assert.match(demo, /const explore = useMemo\(\(\) => filterDemoExplorePosts\(POSTS, search, category\), \[category, search\]\)/);
  assert.match(demo, /const visibleExplore = useMemo\(\(\) => exploreSavedOnly\s*\?\s*selectSavedPosts\(explore, saves, null\) : explore, \[explore, saves, exploreSavedOnly\]\)/);
  assert.match(demo, /const exploreSavedCount = useMemo\(\(\) => selectSavedPosts\(POSTS, saves, null\)\.length, \[saves\]\)/);
  assert.match(demo, /accessibilityRole="checkbox" accessibilityState=\{\{ checked: exploreSavedOnly \}\}/);
  assert.match(demo, /accessibilityLabel="Show only locally saved sample work"/);
  assert.match(demo, /accessibilityHint="Combines with search and skill filters\. Saves last only this session\."/);
  assert.match(demo, /onPress=\{\(\) => setExploreSavedOnly\(old => !old\)\}/);
  assert.match(demo, /exploreSavedFilter: \{ minHeight: layout\.minTapTarget/);
  assert.match(demo, /visibleExplore\.length} fictional \{visibleExplore\.length === 1 \? "result" : "results"}/);
  assert.match(demo, /visibleExplore\.map\(post => <View key=\{post\.id\} style=\{styles\.exploreCard\}>/);
});

check("Empty saved view explains what's missing, reset clears all active Explore filters",()=>{
  assert.match(demo, /const hasExploreFilters = Boolean\(search\.trim\(\)\) \|\| category !== "All" \|\| exploreSavedOnly/);
  assert.match(demo, /No locally saved sample work matches these filters/);
  assert.match(demo, /function resetExploreFilters\(\) \{\s*setSearch\(""\);\s*setCategory\("All"\);\s*setExploreSavedOnly\(false\);/);
  assert.match(demo, /accessibilityLabel="Clear Explore search and filters"/);
  assert.match(demo, /onPress=\{resetExploreFilters\}/);
  assert.match(demo, /const savedCollectionsForPost = saves\[current\.id\] \|\| \[\]/);
  assert.match(demo, /onPress=\{\(\) => toggleSave\(current\.id, collection\)\}/);
  assert.match(demo, /onPress=\{\(\) => open\("save", post\)\}/);
  assert.match(demo, /onPress=\{\(\) => openWorkInFeed\(post\.id\)\}/);
});

check("Prior A1/A2 guards, disclosed fictional boundaries and manual Expo approval remain",()=>{
  for (const required of ["onArtworkTap(post.id)","const orderedComments = orderDemoComments(currentComments)",
    "filterDemoExplorePosts(POSTS, search, category)","selectSavedPosts(POSTS, saves, selectedCollection)",
    "OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS","Illustrated sample, not real video",
    "Shopping and checkout are disabled in this demo","No real availability is checked and no booking will be created"]) {
    assert.ok(demo.includes(required), required);
  }
  for(const banned of [/\bfetch\s*\(/,/\baxios\./,/\bcreateClient\s*\(/,/\bmobileApi\./,/\binitializePayment\s*\(/]) {
    assert.doesNotMatch(demo,banned);
  }
  const ci=readRoot(".github/workflows/mobile-cloud-validation.yml");
  const manual=readRoot(".github/workflows/hustle-offline-android-demo.yml");
  for (const suffix of ["a21-feed","a22-social","a23-offer","a24-integration","a25-explore-work",
    "a26-explore-search","a27-explore-save","a28-saved-filter"]) {
    const command="node apps/mobile/scripts/ux004-"+suffix+"-contract.cjs";
    assert.ok(ci.includes(command),"Missing Mobile CI "+command);
    assert.ok(manual.includes(command),"Missing manual preflight "+command);
  }
  assert.match(manual,/workflow_dispatch:/);
  assert.match(manual,/if: inputs\.approve_free_demo_build == true/);
  assert.ok(manual.indexOf("ux004-a28-saved-filter-contract.cjs") < manual.indexOf("eas build --platform android"));
  const qa=readRoot("Knowledge/QA/HUSTLE_UX004_A28_SAVED_EXPLORE.md");
  assert.match(qa,/Device acceptance: PENDING/);
  assert.match(qa,/No Expo APK/);
});
console.log("UX004-A2.8 saved Explore filter contract passed; phone/Waydroid remains PENDING.");
