#!/usr/bin/env node
// UX004-A2.2: pure functional tests + static UI safety contracts.
// Runs only in free GitHub cloud CI or a manual owner-approved preflight.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname,"..");
const repo = path.resolve(root,"../..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");
const demo = read("src/experience/DemoExperience.tsx");
const sourcePath = path.join(root,"src/ux004/feed/demoSocial.ts");
const modelSource = fs.readFileSync(sourcePath,"utf8");
// Transpile only this package-free, pure TypeScript helper for real model tests.
const emitted = ts.transpileModule(modelSource, {compilerOptions:{
  target:ts.ScriptTarget.ES2020, module:ts.ModuleKind.CommonJS, strict:true
}});
const socialModule = new Module(sourcePath,module);
socialModule.filename = sourcePath;
socialModule.paths = Module._nodeModulePaths(path.dirname(sourcePath));
socialModule._compile(emitted.outputText,sourcePath);
const { orderDemoComments, replyRootId, selectSavedPosts } = socialModule.exports;

function check(name,fn){fn();console.log("PASS: "+name);}

check("thread order groups roots with direct replies without losing nested or orphan data",()=>{
 const notes = [
  {id:"a",handle:"artist",body:"root"},
  {id:"b",handle:"you.demo",body:"reply",parentId:"a"},
  {id:"c",handle:"second",body:"root 2"},
  {id:"d",handle:"you.demo",body:"reply root 2",parentId:"c"},
  {id:"e",handle:"you.demo",body:"nested",parentId:"b"},
  {id:"f",handle:"ghost",body:"orphan",parentId:"nope"},
 ];
 assert.deepEqual(orderDemoComments(notes).map(n=>n.id),["a","b","c","d","f","e"]);
 assert.equal(orderDemoComments(notes).length,notes.length);
 assert.deepEqual(orderDemoComments([]),[]);
});
check("reply selection attaches nested replies to the original root",()=>{
 const notes=[{id:"r",handle:"artist",body:"root"},{id:"a",handle:"demo",body:"child",parentId:"r"},{id:"b",handle:"demo",body:"nested",parentId:"a"}];
 assert.equal(replyRootId(notes,"r"),"r");
 assert.equal(replyRootId(notes,"a"),"r");
 assert.equal(replyRootId(notes,"b"),"r");
 assert.equal(replyRootId(notes,"missing"),null);
});
check("saved collections are independent and preserve fixture order",()=>{
 const posts=[{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
 const saves={a:["Inspiration"],b:["Outfit ideas"],c:["Inspiration","Outfit ideas"],d:[]};
 assert.deepEqual(selectSavedPosts(posts,saves,"Inspiration").map(p=>p.id),["a","c"]);
 assert.deepEqual(selectSavedPosts(posts,saves,"Outfit ideas").map(p=>p.id),["b","c"]);
 assert.deepEqual(selectSavedPosts(posts,saves,null).map(p=>p.id),["a","b","c"]);
 assert.deepEqual(selectSavedPosts(posts,{},"Outfit ideas"),[]);
});
check("UI wires parent reply, cancel, keyboard submission and local summary",()=>{
 assert.match(demo,/import \{ orderDemoComments, replyRootId, selectSavedPosts \} from/);
 assert.match(demo,/const orderedComments = orderDemoComments\(currentComments\)/);
 assert.match(demo,/orderedComments\.map\(note =>/);
 assert.match(demo,/setReplyTo\(replyRootId\(currentComments, note\.id\)\)/);
 assert.match(demo,/Replying to @\{replyTarget\.handle\} · demo only/);
 assert.match(demo,/accessibilityLabel="Cancel demo reply"/);
 assert.match(demo,/onPress=\{\(\) => setReplyTo\(null\)\}/);
 assert.match(demo,/maxLength=\{500\}/);
 assert.match(demo,/returnKeyType="send" onSubmitEditing=\{addComment\}/);
 assert.match(demo,/Only saved in this session/);
 assert.match(demo,/accessibilityLabel=\{"Reply to @" \+ note\.handle\}/);
});
check("named collection feed, restore and checked save feedback all wired",()=>{
 assert.match(demo,/setSelectedCollection\(collection\)/);
 assert.match(demo,/selectSavedPosts\(POSTS, saves, selectedCollection\)/);
 assert.match(demo,/onPress=\{\(\) => openSavedCollection\(collection\)\}/);
 assert.match(demo,/saved-" \+ selectedCollection/); // separate saved FlatList identity
 assert.match(demo,/No posts in " \+ selectedCollection \+ " yet/);
 assert.match(demo,/onPress=\{returnToForYou\}/);
 assert.match(demo,/setIndex\(regularFeedIndex\.current\)/);
 assert.match(demo,/accessibilityRole="checkbox" accessibilityState=\{\{ checked: enabled \}\}/);
 assert.match(demo,/savedCollectionsForPost\.join\(" and "\)/);
 assert.match(demo,/Not saved to any collection/);
});
check("A1 modal/nav contracts and OFFLINE/NO-COMMERCE disclosures remain",()=>{
 assert.match(demo,/onRequestClose=\{requestDismissSheet\}/);
 assert.match(demo,/\{!keyboardVisible && <FloatingTabBar/);
 assert.match(demo,/regularFeedIndex\.current/);
 assert.match(demo,/OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS/);
 assert.match(demo,/Publishing is disabled in the offline preview/);
 assert.match(demo,/Shopping and checkout are disabled in this demo/);
 for(const banned of [/\bfetch\s*\(/,/axios\./,/createClient\s*\(/,/mobileApi\./,/initializePayment\s*\(/,/DATABASE_URL/]){
  assert.doesNotMatch(demo,banned,"Demo experience must remain backend-free");
 }
});
check("No Expo EAS build triggered, no device acceptance claimed",()=>{
 const ci=fs.readFileSync(path.join(repo,".github/workflows/mobile-cloud-validation.yml"),"utf8");
 const manual=fs.readFileSync(path.join(repo,".github/workflows/hustle-offline-android-demo.yml"),"utf8");
 const qa=fs.readFileSync(path.join(repo,"Knowledge/QA/HUSTLE_UX004_A22_COMMENTS_COLLECTIONS.md"),"utf8");
 assert.match(ci,/node apps\/mobile\/scripts\/ux004-a22-social-contract\.cjs/);
 assert.match(manual,/node apps\/mobile\/scripts\/ux004-a22-social-contract\.cjs/);
 assert.match(manual,/workflow_dispatch:/);
 assert.match(manual,/if: inputs\.approve_free_demo_build == true/);
 assert.match(qa,/Device acceptance: PENDING/);
 assert.match(qa,/No Expo build/);
});
console.log("UX004-A2.2 pure social selectors and source contracts PASS; hardware acceptance remains pending.");
