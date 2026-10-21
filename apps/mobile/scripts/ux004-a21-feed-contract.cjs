#!/usr/bin/env node
// UX004-A2.1: offline Feed gesture/accessibility regression contract.
// Static code checks are NOT a phone/emulator test. No Expo build or server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = path.resolve(__dirname,"..");
const read = rel => fs.readFileSync(path.join(base,rel),"utf8");
const demo = read("src/experience/DemoExperience.tsx");
const a1 = read("scripts/ux004-a14-integration-audit.cjs");
const offline = read("scripts/offline-demo-contract.cjs");
const metro = read("metro.config.js");
const navigation = read("src/ux004/navigation/useDemoAndroidBack.ts");
const root = path.resolve(base,"../..");
const readRoot = p=>fs.readFileSync(path.join(root,p),"utf8");
const ci = readRoot(".github/workflows/mobile-cloud-validation.yml");
const build = readRoot(".github/workflows/hustle-offline-android-demo.yml");
const spec = readRoot("Knowledge/QA/HUSTLE_UX004_A21_FEED_GESTURES.md");
const check = (name,fn)=>{fn();console.log("PASS: "+name);};

check("Double-tap policy applies only to the same post, within 300ms",()=>{
 assert.match(demo,/lastArtworkTap = useRef<\{ postId: string; timestamp: number \} \| null>\(null\)/);
 assert.match(demo,/function onArtworkTap\(postId: string\)/);
 assert.match(demo,/const timestamp = Date\.now\(\)/);
 assert.match(demo,/previous\?\.postId === postId/);
 assert.match(demo,/timestamp - previous\.timestamp > 0/);
 assert.match(demo,/timestamp - previous\.timestamp <= 300/);
 assert.match(demo,/lastArtworkTap\.current = \{ postId, timestamp \}/);
 assert.match(demo,/lastArtworkTap\.current = null;/);
 assert.match(demo,/previousLikes\.includes\(postId\) \? previousLikes : \[\.\.\.previousLikes, postId\]/);
 assert.doesNotMatch(demo,/setTimeout\(|setInterval\(/);
});
check("Invisible artwork target does not take screen-reader focus",()=>{
 assert.match(demo,/<Pressable style=\{styles\.artworkTapTarget\} onPress=\{\(\) => onArtworkTap\(post\.id\)\}/);
 assert.match(demo,/accessible=\{false\} importantForAccessibility="no"/);
 assert.match(demo,/testID=\{"demo-artwork-" \+ post\.id\}/);
 assert.match(demo,/artworkTapTarget: \{ \.\.\.StyleSheet\.absoluteFillObject \}/);
 assert.ok(demo.indexOf("<View style={styles.posterShade}")<demo.indexOf('onArtworkTap(post.id)'));
 assert.ok(demo.indexOf('onArtworkTap(post.id)')<demo.indexOf('<View style={[styles.topRow'));
});
check("Labeled rail Like remains independently accessible and can unlike",()=>{
 assert.match(demo,/function toggleLike\(id: string\)/);
 assert.match(demo,/v\.includes\(id\) \? v\.filter\(x => x !== id\) : \[\.\.\.v, id\]/);
 assert.match(demo,/accessibilityLabel=\{accessibleLabel\}/);
 assert.match(demo,/\(heart\(post\) \? "Unlike " : "Like "\) \+ post\.name/);
 assert.match(demo,/Read comments on " \+ post\.name/);
 assert.match(demo,/Manage collections for " \+ post\.name/);
 assert.match(demo,/Share fictional work from " \+ post\.name/);
});
check("Caption expansion is local to each post, separately tappable and reversible",()=>{
 assert.match(demo,/\[expandedCaptions, setExpandedCaptions\] = useState<string\[]>\(\[\]\)/);
 assert.match(demo,/function toggleCaption\(id: string\)/);
 assert.match(demo,/old\.includes\(id\) \? old\.filter\(value => value !== id\) : \[\.\.\.old, id\]/);
 assert.match(demo,/onPress=\{\(\) => toggleCaption\(post\.id\)\} style=\{styles\.captionTapTarget\}/);
 assert.match(demo,/numberOfLines=\{expandedCaptions\.includes\(post\.id\) \? undefined : 2\}/);
 assert.match(demo,/\? "Show less" : "Read more"/);
 assert.match(demo,/captionTapTarget: \{ minHeight: layout\.minTapTarget/);
 assert.match(demo,/accessibilityLabel=\{\(expandedCaptions\.includes\(post\.id\)/);
});
check("Approved A1 acceptance, original controls and safe disconnected demo are preserved",()=>{
 assert.match(a1,/A1 owner acceptance preserved/);
 assert.match(demo,/initialScrollIndex=\{Math\.min\(index,/);
 assert.match(demo,/regularFeedIndex\.current/);
 assert.match(demo,/onRequestClose=\{requestDismissSheet\}/);
 assert.match(demo,/onPress=\{\(\) => openSavedCollection\(collection\)\}/);
 assert.match(demo,/Publishing is disabled in the offline preview/);
 assert.match(demo,/No real availability is checked and no booking will be created/);
 assert.match(demo,/Shopping and checkout are disabled in this demo/);
 assert.match(demo,/OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS/);
 assert.match(offline,/approve_free_demo_build/);
 assert.match(metro,/config\.resolver\.resolveRequest/);
 for(const banned of [/\bfetch\s*\(/,/axios\./,/createClient\s*\(/,/mobileApi\./,/initializePayment\s*\(/,/https?:\/\/[^\s'"]+/]) {
  assert.doesNotMatch(demo,banned);
 }
});
check("No independent device pass, extra dependency, or automatic EAS build claimed",()=>{
 assert.match(spec,/Device acceptance: PENDING/);
 assert.match(spec,/No new Expo APK/);
 assert.match(ci,/node apps\/mobile\/scripts\/ux004-a21-feed-contract\.cjs/);
 assert.match(build,/node apps\/mobile\/scripts\/ux004-a21-feed-contract\.cjs/);
 assert.match(build,/workflow_dispatch:/);
 assert.match(build,/if: inputs\.approve_free_demo_build == true/);
});
console.log("UX004-A2.1 static guards passed; CI/Metro is NOT evidence of physical Android acceptance.");
