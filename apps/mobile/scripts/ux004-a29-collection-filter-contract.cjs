#!/usr/bin/env node
/**
 * UX004-A2.9: real content-search + saved-work named-collection intersection.
 * Tests actual pure source helpers and the literal demo fixtures without any
 * network, React Native runtime or new Android APK. Real device QA PENDING.
 */
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const mobile = path.resolve(__dirname,"..");
const repo = path.resolve(mobile,"../..");
const demo = fs.readFileSync(path.join(mobile,"src/experience/DemoExperience.tsx"),"utf8");
const readRoot = p => fs.readFileSync(path.join(repo,p),"utf8");
function verify(label, fn) { fn(); console.log("PASS: "+label); }
function load(relative) {
  const filename=path.join(mobile,relative);
  const output=ts.transpileModule(fs.readFileSync(filename,"utf8"),{compilerOptions:{
    target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true
  },reportDiagnostics:true});
  assert.equal((output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
  const m=new Module(filename,module);
  m.filename=filename;
  m.paths=Module._nodeModulePaths(path.dirname(filename));
  m._compile(output.outputText,filename);
  return m.exports;
}
function fixtures() {
  const file=ts.createSourceFile("DemoExperience.tsx",demo,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let init;
  function walk(n) {
    if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.name.text==="POSTS")init=n.initializer;
    ts.forEachChild(n,walk);
  }
  walk(file);
  assert.ok(init&&ts.isArrayLiteralExpression(init),"Current POSTS fixtures must be literal");
  function literal(n) {
    if(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))return n.text;
    if(ts.isNumericLiteral(n))return Number(n.text);
    if(ts.isArrayLiteralExpression(n))return n.elements.map(literal);
    if(ts.isObjectLiteralExpression(n)) {
      const out={};
      for(const p of n.properties){
        assert.ok(ts.isPropertyAssignment(p));
        assert.ok(ts.isIdentifier(p.name)||ts.isStringLiteral(p.name));
        out[p.name.text]=literal(p.initializer);
      }
      return out;
    }
    throw Error("Nonliteral demo fixture: "+ts.SyntaxKind[n.kind]);
  }
  return literal(init);
}
const posts=fixtures(),ids=p=>p.map(item=>item.id);
const {filterDemoExplorePosts}=load("src/ux004/discovery/demoExploreSearch.ts");
const {selectSavedPosts}=load("src/ux004/feed/demoSocial.ts");
function select(query,category,savedOnly,collection,saves) {
  const searched=filterDemoExplorePosts(posts,query,category);
  return savedOnly?selectSavedPosts(searched,saves,collection):searched;
}

verify("Actual fictional posts and empty saved collections preserve order",()=>{
  assert.deepEqual(ids(posts),["p1","p2","p3","p4"]);
  const original=JSON.stringify(posts);
  for(const collection of [null,"Inspiration","Outfit ideas"])
    assert.deepEqual(ids(select("","All",true,collection,{})),[]);
  assert.deepEqual(ids(select("","All",false,"Inspiration",{})),ids(posts));
  assert.equal(JSON.stringify(posts),original);
});
verify("All saved union versus independent named collections is accurate and not duplicated",()=>{
  const saves={p1:["Inspiration","Outfit ideas"],p2:["Outfit ideas"],p3:["Inspiration"]};
  assert.deepEqual(ids(select("","All",true,null,saves)),["p1","p2","p3"]);
  assert.deepEqual(ids(select("","All",true,"Inspiration",saves)),["p1","p3"]);
  assert.deepEqual(ids(select("","All",true,"Outfit ideas",saves)),["p1","p2"]);
  assert.equal(selectSavedPosts(posts,saves,null).length,3);
  assert.equal(selectSavedPosts(posts,saves,"Inspiration").length,2);
  assert.equal(selectSavedPosts(posts,saves,"Outfit ideas").length,2);
  assert.deepEqual(ids(select("","All",false,"Outfit ideas",saves)),ids(posts));
});
verify("Named collections intersect across matching content words and skill category",()=>{
  const saves={p1:["Inspiration","Outfit ideas"],p2:["Outfit ideas"],p4:["Inspiration"]};
  assert.deepEqual(ids(select("two-piece","Fashion",true,"Inspiration",saves)),["p1"]);
  assert.deepEqual(ids(select("sharp fade","Beauty",true,"Outfit ideas",saves)),["p2"]);
  assert.deepEqual(ids(select("sharp fade","Beauty",true,"Inspiration",saves)),[]);
  assert.deepEqual(ids(select("portrait","Media",true,"Inspiration",saves)),["p4"]);
  assert.deepEqual(ids(select("spice","Food",true,null,saves)),[]);
  assert.deepEqual(ids(select("portrait","Media",false,"Outfit ideas",saves)),["p4"]);
});
verify("Collection membership changes immediately affect only related selection",()=>{
  const saves={p1:["Inspiration","Outfit ideas"],p2:["Outfit ideas"]};
  assert.deepEqual(ids(select("","All",true,"Inspiration",saves)),["p1"]);
  saves.p1=["Outfit ideas"];
  assert.deepEqual(ids(select("","All",true,"Inspiration",saves)),[]);
  assert.deepEqual(ids(select("","All",true,"Outfit ideas",saves)),["p1","p2"]);
  saves.p1=[];
  assert.deepEqual(ids(select("","All",true,"Outfit ideas",saves)),["p2"]);
  assert.deepEqual(ids(select("","All",true,null,saves)),["p2"]);
});
verify("Saved-only UI reveals three accessible, 48dp collection options",()=>{
  assert.match(demo,/const \[exploreSavedCollection, setExploreSavedCollection\] = useState<Collection \| null>\(null\)/);
  assert.match(demo,/const visibleExplore = useMemo\(\(\) => exploreSavedOnly\s*\?\s*selectSavedPosts\(explore, saves, exploreSavedCollection\) : explore,/);
  assert.match(demo,/\[explore, saves, exploreSavedOnly, exploreSavedCollection\]/);
  assert.match(demo,/\{exploreSavedOnly && <ScrollView horizontal style=\{styles\.exploreCollectionStrip\}/);
  assert.match(demo,/\(\[null, "Inspiration", "Outfit ideas"\] as const\)\.map\(collection =>/);
  assert.match(demo,/const active = exploreSavedCollection === collection/);
  assert.match(demo,/const count = selectSavedPosts\(POSTS, saves, collection\)\.length/);
  assert.match(demo,/const label = collection \?\? "All saved"/);
  assert.match(demo,/accessibilityRole="tab" accessibilityState=\{\{ selected: active \}\}/);
  assert.match(demo,/accessibilityLabel=\{label \+ " collection, " \+ count \+ " locally saved sample posts"\}/);
  assert.match(demo,/onPress=\{\(\) => setExploreSavedCollection\(collection\)\}/);
  assert.match(demo,/exploreCollectionTab: \{ minHeight: layout\.minTapTarget/);
  assert.match(demo,/visibleExplore\.length} fictional \{visibleExplore\.length === 1 \? "result" : "results"}/);
});
verify("Empty scoped collection gives appropriate guidance and full reset is reversible",()=>{
  assert.match(demo,/No locally saved sample work in " \+ exploreSavedCollection \+ " matches these filters/);
  assert.match(demo,/Try All saved or clear filters/);
  assert.match(demo,/function resetExploreFilters\(\) \{\s*setSearch\(""\);\s*setCategory\("All"\);\s*setExploreSavedOnly\(false\);\s*setExploreSavedCollection\(null\);/);
  assert.match(demo,/accessibilityLabel="Clear Explore search and filters"/);
  assert.match(demo,/onPress=\{resetExploreFilters\}/);
  assert.match(demo,/onPress=\{\(\) => open\("save", post\)\}/);
  assert.match(demo,/onPress=\{\(\) => openWorkInFeed\(post\.id\)\}/);
  assert.match(demo,/selectSavedPosts\(POSTS, saves, selectedCollection\)/);
  assert.match(demo,/setIndex\(regularFeedIndex\.current\)/);
});
verify("All earlier offline safety boundaries and cloud preflight approval gates hold",()=>{
  for(const needle of ["onArtworkTap(post.id)","filterDemoExplorePosts(POSTS, search, category)",
    "const orderedComments = orderDemoComments(currentComments)","Shopping and checkout are disabled in this demo",
    "OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS","No real availability is checked and no booking will be created",
    "Illustrated sample, not real video"])assert.ok(demo.includes(needle),needle);
  for(const forbidden of [/\bfetch\s*\(/,/\baxios\./,/\bcreateClient\s*\(/,/\bmobileApi\./,/\binitializePayment\s*\(/])
    assert.doesNotMatch(demo,forbidden);
  const ci=readRoot(".github/workflows/mobile-cloud-validation.yml");
  const manual=readRoot(".github/workflows/hustle-offline-android-demo.yml");
  for(const s of ["a21-feed","a22-social","a23-offer","a24-integration","a25-explore-work",
     "a26-explore-search","a27-explore-save","a28-saved-filter","a29-collection-filter"]) {
    const cmd="node apps/mobile/scripts/ux004-"+s+"-contract.cjs";
    assert.ok(ci.includes(cmd),"Missing Mobile CI: "+cmd);
    assert.ok(manual.includes(cmd),"Missing manual Expo preflight: "+cmd);
  }
  assert.match(manual,/workflow_dispatch:/);
  assert.match(manual,/if: inputs\.approve_free_demo_build == true/);
  assert.ok(manual.indexOf("ux004-a29-collection-filter-contract.cjs")<manual.indexOf("eas build --platform android"));
  const qa=readRoot("Knowledge/QA/HUSTLE_UX004_A29_COLLECTION_DISCOVERY.md");
  assert.match(qa,/Device acceptance: PENDING/);
  assert.match(qa,/No Expo APK/);
});
console.log("UX004-A2.9 named collection discovery contract PASSED; real Android acceptance PENDING.");
