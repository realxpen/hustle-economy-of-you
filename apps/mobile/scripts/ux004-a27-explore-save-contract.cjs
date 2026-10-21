#!/usr/bin/env node
/**
 * UX004-A2.7: Explore work saving integrates with the existing fictional,
 * in-memory, per-post named collections. Node/source contract only, not APK QA.
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
const socialPath = path.join(mobile,"src/ux004/feed/demoSocial.ts");
const emitted = ts.transpileModule(fs.readFileSync(socialPath,"utf8"), {
  compilerOptions: {target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,strict:true}
});
const social = new Module(socialPath, module);
social.filename = socialPath;
social.paths = Module._nodeModulePaths(path.dirname(socialPath));
social._compile(emitted.outputText,socialPath);
const {selectSavedPosts} = social.exports;
const readRoot = p => fs.readFileSync(path.join(repo,p),"utf8");
function check(name, fn) { fn(); console.log("PASS: " + name); }

function actualPosts() {
  const ast = ts.createSourceFile("DemoExperience.tsx",demo,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  let initializer;
  function visit(node) {
    if(ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "POSTS") initializer=node.initializer;
    ts.forEachChild(node,visit);
  }
  visit(ast);
  assert.ok(initializer && ts.isArrayLiteralExpression(initializer),"Expected literal demo posts");
  return initializer.elements.map(post => {
    assert.ok(ts.isObjectLiteralExpression(post));
    const entry=post.properties.find(p=>ts.isPropertyAssignment(p)&&p.name.getText(ast)==="id");
    assert.ok(entry&&ts.isPropertyAssignment(entry)&&ts.isStringLiteral(entry.initializer));
    return {id:entry.initializer.text};
  });
}
const posts=actualPosts();
const ids=list=>list.map(post=>post.id);

check("All actual sample work IDs stay in original Feed order",()=>{
  assert.deepEqual(ids(posts),["p1","p2","p3","p4"]);
  assert.deepEqual(ids(selectSavedPosts(posts,{},null)),[]);
});
check("Explore save and unsave states feed the SAME Inspiration/Outfit ideas selector",()=>{
  const saves={};
  const first=posts[0].id,second=posts[1].id;
  saves[first]=["Inspiration"];
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Inspiration")),[first]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Outfit ideas")),[]);
  saves[second]=["Outfit ideas"];
  saves[first]=["Inspiration","Outfit ideas"];
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Inspiration")),[first]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Outfit ideas")),[first,second]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,null)),[first,second]);
  saves[first]=["Outfit ideas"];
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Inspiration")),[]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,"Outfit ideas")),[first,second]);
  assert.deepEqual(ids(selectSavedPosts(posts,saves,null)),[first,second]);
  saves[second]=[];
  assert.deepEqual(ids(selectSavedPosts(posts,saves,null)),[first]);
});
check("Explore actions are separate siblings and the save button opens the existing sheet",()=>{
  const start=demo.indexOf("explore.map(post => <View key={post.id} style={styles.exploreCard}>");
  const end=demo.indexOf("</View>)}",start);
  assert.ok(start>0&&end>start);
  const card=demo.slice(start,end);
  assert.match(card,/onPress=\{\(\) => open\("creator", post\)\}/);
  assert.match(card,/onPress=\{\(\) => openWorkInFeed\(post\.id\)\}/);
  assert.match(card,/<View style=\{styles\.exploreActions\}>/);
  assert.match(card,/onPress=\{\(\) => open\("save", post\)\}/);
  assert.ok(card.indexOf("onPress={() => openWorkInFeed(post.id)}") <
            card.indexOf("onPress={() => open(\"save\", post)}"));
  assert.ok(card.indexOf("</Pressable>",card.indexOf("onPress={() => openWorkInFeed(post.id)}")) <
            card.indexOf('accessibilityLabel={"Manage local saved collections for "'));
  assert.match(demo,/function open\(type: Sheet, post: Post\) \{\s*setChosenPost\(post\.id\); setSheet\(type\);/);
  assert.match(demo,/const savedCollectionsForPost = saves\[current\.id\] \|\| \[\]/);
});
check("Saved state and local-only category names remain visible to screen readers",()=>{
  assert.match(demo,/accessibilityLabel=\{"Manage local saved collections for " \+ post\.name\}/);
  assert.match(demo,/accessibilityState=\{\{ selected: \(saves\[post\.id\] \|\| \[\]\)\.length > 0 \}\}/);
  assert.match(demo,/Saved locally to " \+ saves\[post\.id\]\.join\(" and "\)/);
  assert.match(demo,/Choose Inspiration or Outfit ideas\. Nothing saved to a server\./);
  assert.match(demo,/\(saves\[post\.id\] \|\| \[\]\)\.length \? "Saved ✓" : "Save work"/);
  assert.match(demo,/I name=\{\(saves\[post\.id\] \|\| \[\]\)\.length \? "bookmark" : "bookmark-outline"\}/);
  assert.match(demo,/exploreActions: \{ flexDirection: "row"/);
  assert.match(demo,/exploreWorkTarget: \{ flex: 1/);
  assert.match(demo,/exploreSaveTarget: \{ flex: 1/);
  assert.match(demo,/exploreSaveTarget: \{[^}]*minHeight: layout\.minTapTarget/);
  assert.match(demo,/exploreWorkTarget: \{[^}]*minHeight: layout\.minTapTarget/);
});
check("Existing selected-post save sheet toggles both collections, and empty/saved feedback remains",()=>{
  assert.match(demo,/function toggleSave\(id: string, collection: Collection\)/);
  assert.match(demo,/const current = old\[id\] \|\| \[\]/);
  assert.match(demo,/current\.includes\(collection\) \? current\.filter\(x => x !== collection\) : \[\.\.\.current, collection\]/);
  assert.match(demo,/onPress=\{\(\) => toggleSave\(current\.id, collection\)\}/);
  assert.match(demo,/accessibilityRole="checkbox" accessibilityState=\{\{ checked: enabled \}\}/);
  assert.match(demo,/savedCollectionsForPost\.join\(" and "\)/);
  assert.match(demo,/Not saved to any collection/);
  assert.match(demo,/onPress=\{\(\) => openSavedCollection\(collection\)\}/);
  assert.match(demo,/selectSavedPosts\(POSTS, saves, selectedCollection\)/);
  assert.match(demo,/setIndex\(regularFeedIndex\.current\)/);
  assert.match(demo,/onRequestClose=\{requestDismissSheet\}/);
});
check("Prior work discovery, offline disclaimers and separately approved build are unchanged",()=>{
  for (const statement of ["filterDemoExplorePosts(POSTS, search, category)","onArtworkTap(post.id)",
    "onPress={() => openWorkInFeed(post.id)}","const orderedComments = orderDemoComments(currentComments)",
    "Illustrated sample, not real video","OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS",
    "Shopping and checkout are disabled in this demo","No real availability is checked and no booking will be created"]) {
    assert.ok(demo.includes(statement),statement);
  }
  for (const forbidden of [/\bfetch\s*\(/,/\baxios\./,/\bcreateClient\s*\(/,/\bmobileApi\./,/\binitializePayment\s*\(/]) {
    assert.doesNotMatch(demo,forbidden);
  }
  const ci=readRoot(".github/workflows/mobile-cloud-validation.yml");
  const manual=readRoot(".github/workflows/hustle-offline-android-demo.yml");
  for(const suffix of ["a21-feed","a22-social","a23-offer","a24-integration","a25-explore-work","a26-explore-search","a27-explore-save"]) {
    const cmd="node apps/mobile/scripts/ux004-"+suffix+"-contract.cjs";
    assert.ok(ci.includes(cmd),cmd+" missing Mobile CI");
    assert.ok(manual.includes(cmd),cmd+" missing gated Expo preflight");
  }
  assert.match(manual,/workflow_dispatch:/);
  assert.match(manual,/if: inputs\.approve_free_demo_build == true/);
  assert.ok(manual.indexOf("ux004-a27-explore-save-contract.cjs") < manual.indexOf("eas build --platform android"));
  const qa=readRoot("Knowledge/QA/HUSTLE_UX004_A27_EXPLORE_SAVE.md");
  assert.match(qa,/Device acceptance: PENDING/);
  assert.match(qa,/No Expo APK/);
});
console.log("UX004-A2.7 Explore save contracts PASS; physical Android verification PENDING.");
