#!/usr/bin/env node
/** UX004-A1.4: deterministic, dependency-free integration READINESS audit.
 * It does NOT claim real-device, screenshot, keyboard or touch acceptance.
 * Run in GitHub Cloud CI and as a cheap gate before explicitly approved EAS.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const base = path.resolve(root,"../..");
const read = p => fs.readFileSync(path.join(root,p),"utf8");
const rootRead = p => fs.readFileSync(path.join(base,p),"utf8");
const demo=read("src/experience/DemoExperience.tsx");
const app=read("App.tsx");
const color=read("src/ux004/theme/colors.ts");
const nav=read("src/ux004/components/FloatingTabBar.tsx");
const layout=read("src/ux004/theme/layout.ts");
const controller=read("src/ux004/navigation/useDemoNavigation.ts");
const androidBack=read("src/ux004/navigation/useDemoAndroidBack.ts");
const screen=read("src/ux004/components/HybridScreenSurface.tsx");
const disclosure=read("src/ux004/components/DemoDisclosure.tsx");
const metro=read("metro.config.js");
const ci=rootRead(".github/workflows/mobile-cloud-validation.yml");
const apk=rootRead(".github/workflows/hustle-offline-android-demo.yml");
const qa=rootRead("Knowledge/QA/HUSTLE_UX004_A14_INTEGRATION_ACCEPTANCE.md");
const reviewed=rootRead("Knowledge/UX/HUSTLE_UX004_A1_DESIGN_SYSTEM_NAVIGATION_SPEC.md");
const results=[];
function verify(name,fn) { fn(); results.push(name); }
function token(name){
 const re = new RegExp("\\b"+name+': "(#[0-9A-Fa-f]{6})"');
 const m=color.match(re);assert.ok(m,"Missing color "+name);return m[1];
}
function luminance(hex){
 const p=[1,3,5].map(i=>parseInt(hex.substring(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
 return .2126*p[0]+.7152*p[1]+.0722*p[2];
}
function contrast(a,b) {let x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function styleFontSize(style){
 const start=demo.match(new RegExp("\\b"+style+": \\{([^}]+)\\}"));
 assert.ok(start,"Missing style "+style);
 const size=start[1].match(/fontSize:\s*(\d+)/);
 assert.ok(size,"Missing fontSize on "+style);
 return Number(size[1]);
}
verify("Locked Hybrid screen roles and contrast",()=>{
 assert.match(reviewed,/Hybrid — dark immersive Feed and future Live/i);
 assert.match(color,/darkFeed: colors\.ink/);
 assert.match(color,/lightUtility: colors\.paper/);
 assert.match(screen,/surfaceColors\[mode\]/);
 assert.match(demo,/mode=\{screen === "Home" \? "darkFeed" : "lightUtility"\}/);
 for(const [fg,bg] of [["textPrimaryLight","paper"],["textSecondaryLight","paper"],["textPrimaryDark","ink"],["lime","ink"]]){
  assert.ok(contrast(token(fg),token(bg))>=4.5,fg+" on "+bg+" fails 4.5:1");
 }
});
verify("Legible and truthful sample/transaction disclosures",()=>{
 assert.ok(styleFontSize("mediaDisclosure")>=12,"Media fictional-content notice is too small");
 assert.ok(styleFontSize("demoNoticeText")>=13,"Offer/location/demo notice is too small");
 assert.ok(styleFontSize("sheetDisclaimer")>=12,"No transaction notice is too small");
 assert.match(demo,/OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS/);
 assert.match(demo,/Illustrated sample, not real video/);
 assert.match(demo,/No real availability is checked/);
 assert.match(disclosure,/accessibilityLabel=\{label\}/);
});
verify("Four real tabs and separate disabled Create action",()=>{
 for(const name of ['"Home"','"Explore"','"Inbox"','"You"']){
  assert.ok(controller.includes(name)||nav.includes(name),"Missing tab "+name);
 }
 assert.ok(nav.indexOf("{LEFT.map(renderTab)}")<nav.indexOf('name="add-circle-outline"'));
 assert.ok(nav.indexOf('name="add-circle-outline"')<nav.indexOf("{RIGHT.map(renderTab)}"));
 assert.match(nav,/accessibilityRole="tab"/);
 assert.match(nav,/accessibilityRole="button"/);
 assert.match(nav,/unavailable in demo/);
 assert.match(demo,/Publishing is disabled in the offline preview/);
});
verify("Safe floating bar at compact Android widths",()=>{
 const min=Number(layout.match(/minTapTarget:\s*(\d+)/)?.[1]);
 const height=Number(layout.match(/navVisualHeight:\s*(\d+)/)?.[1]);
 const small=Number(layout.match(/navHorizontalInsetCompact:\s*(\d+)/)?.[1]);
 const normal=Number(layout.match(/navHorizontalInset:\s*(\d+)/)?.[1]);
 assert.ok(min>=48 && height>=60,"Minimum bar target/height regressed");
 for(const width of [320,360,390,430]){
  const inset=width<=360?small:normal;
  const usable=width-2*inset-12; // six dp padding on each edge
  assert.ok(usable/5>=min,"Five buttons overlap at "+width+" dp");
 }
 assert.match(nav,/Math\.max\(bottomInset, layout\.navBottomGap\)/);
 assert.match(demo,/paddingBottom: bottomReserve/);
 assert.match(demo,/bottom: bottomReserve/);
});
verify("Existing offline local engagement and tab state",()=>{
 for(const marker of [
  "pagingEnabled","setFeed(label)","setLikes(","setComments(","setSaves(",
  "openSavedCollection","regularFeedIndex.current","setCategory(cat)","onChangeText={setSearch}",
  "onPress={() => open(\"offer\", post)}","returnKeyType=\"send\""
 ])assert.ok(demo.includes(marker),"Missing feature: "+marker);
 assert.match(demo,/initialScrollIndex=\{Math\.min\(index,/);
 assert.match(demo,/if \(destination === screen\) return;/);
 assert.match(demo,/setScreen\(destination\);/);
});
verify("Keyboard/sheet ownership and Android Back boundaries",()=>{
 assert.match(androidBack,/BackHandler\.addEventListener\("hardwareBackPress"/);
 assert.match(androidBack,/subscription\.remove\(\)/);
 assert.match(androidBack,/opened\.remove\(\); closed\.remove\(\)/);
 assert.match(androidBack,/if \(sheetOpen\) return false;/);
 assert.match(androidBack,/if \(activeTab !== "Home"\)/);
 assert.match(demo,/onRequestClose=\{requestDismissSheet\}/);
 assert.match(demo,/if \(Keyboard\.isVisible\(\) \|\| keyboardVisible\)/);
 assert.match(demo,/Keyboard\.dismiss\(\)/);
 assert.match(demo,/keyboardShouldPersistTaps="handled"/);
 assert.match(demo,/styles\.sheetCloseTarget/);
 assert.match(demo,/styles\.sendTarget/);
 assert.match(demo,/\{!keyboardVisible && <FloatingTabBar/);
});
verify("Offline isolation and single-React Android startup fix",()=>{
 assert.match(app,/if \(demo\) return <DemoExperience \/>/);
 assert.match(metro,/config\.resolver\.resolveRequest/);
 for(const [name,source] of [["demo",demo],["navigation",controller],["androidBack",androidBack],["navBar",nav]]){
  assert.doesNotMatch(source,/\bfetch\s*\(|createClient\s*\(|axios\.\w+\(|mobileApi\.|DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|PAYSTACK_SECRET_KEY|initializePayment/,
    name+" must remain demo-only");
 }
});
verify("Cloud-only validation and explicit Expo build approval",()=>{
 assert.match(ci,/ux004-a14-integration-audit\.cjs/);
 assert.match(apk,/ux004-a14-integration-audit\.cjs/);
 assert.match(apk,/workflow_dispatch:/);
 assert.match(apk,/approve_free_demo_build/);
 assert.match(apk,/if: inputs\.approve_free_demo_build == true/);
 assert.match(apk,/eas build --platform android --profile demo --non-interactive --no-wait/);
 assert.ok(apk.indexOf("ux004-a14-integration-audit.cjs")<apk.indexOf("eas build --platform android"),"Gate runs after paid/quota-consuming build");
 assert.doesNotMatch(apk,/\n\s+(push|pull_request):|--auto-submit|eas submit/);
});
verify("Manual physical QA explicitly pending",()=>{
 assert.match(qa,/Status:.*PENDING/i);
 assert.match(qa,/physical Android/i);
 assert.match(qa,/Screenshots.*pending/i);
 assert.match(qa,/No EAS build/i);
});
const result=["### UX004-A1.4 — Automated integration readiness",
 ...results.map(s=>"- ✅ "+s),
 "",
 "**Not certified here:** visual screenshots, actual Android Back/keyboard behavior, tap/scroll feel, font scaling, device stability, or an installed APK.",
 "**Physical review status:** PENDING. This workflow never queues an EAS build."].join("\n");
console.log(result);
if(process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,result+"\n");
