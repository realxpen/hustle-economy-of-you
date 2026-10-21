#!/usr/bin/env node
// A1.2 acceptance guard for the OFFLINE demo. No network, services or Expo quota.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const dir = path.resolve(__dirname, "..");
const read = rel => fs.readFileSync(path.join(dir,rel),"utf8");
const demo=read("src/experience/DemoExperience.tsx");
const tabBar=read("src/ux004/components/FloatingTabBar.tsx");
const navTypes=read("src/ux004/navigation/types.ts");
const controller=read("src/ux004/navigation/useDemoNavigation.ts");
const layout=read("src/ux004/theme/layout.ts");
const offline=read("scripts/offline-demo-contract.cjs");
const app=read("App.tsx");
const metro=read("metro.config.js");
const ci=fs.readFileSync(path.join(dir, "../../.github/workflows/mobile-cloud-validation.yml"),"utf8");
const apk=fs.readFileSync(path.join(dir, "../../.github/workflows/hustle-offline-android-demo.yml"),"utf8");

assert.match(navTypes, /ROOT_TABS = \["Home", "Explore", "Inbox", "You"\]/);
assert.match(navTypes, /RootTab \| "Create"/);
assert.doesNotMatch(navTypes, /"Create"\s*\|\s*"Inbox"/);
assert.ok(tabBar.indexOf('key: "Home"') < tabBar.indexOf('key: "Explore"'));
// LEFT and RIGHT arrays are defined before the JSX; validate both their
// internal order AND the actual render sequence, not source declaration order.
assert.ok(tabBar.indexOf('{LEFT.map(renderTab)}') < tabBar.indexOf('name="add-circle-outline"'));
assert.ok(tabBar.indexOf('name="add-circle-outline"') < tabBar.indexOf('{RIGHT.map(renderTab)}'));
assert.ok(tabBar.indexOf('key: "Inbox"') < tabBar.indexOf('key: "You"'));
assert.match(tabBar, /accessibilityRole="tab"/);
assert.match(tabBar, /accessibilityState=\{\{ selected \}\}/);
assert.match(tabBar, /accessibilityRole="button"/);
assert.match(tabBar, /unavailable in demo/);
assert.match(tabBar, /onPressCreate/);
assert.match(tabBar, /layout\.navVisualHeight/);
assert.match(tabBar, /layout\.minTapTarget/);
assert.match(tabBar, /Math\.max\(bottomInset, layout\.navBottomGap\)/);
assert.match(tabBar, /layout\.navHorizontalInsetCompact/);
assert.match(layout, /minTapTarget: 48/);
assert.match(layout, /navVisualHeight: 62/);
assert.match(layout, /navContentGap: 12/);
assert.match(controller, /useState<RootTab>\("Home"\)/);
assert.match(controller, /previous === next \? previous : next/);
assert.match(demo, /<FloatingTabBar activeTab=\{screen\} onSelectTab=\{selectRootTab\}/);
assert.match(demo, /if \(destination === screen\) return;/);
assert.match(demo, /setSheet\(null\);/);
assert.match(demo, /regularFeedIndex\.current/);
assert.match(demo, /initialScrollIndex=\{Math\.min\(index,/);
assert.match(demo, /if \(!savedOnly\) regularFeedIndex\.current = next;/);
assert.match(demo, /setIndex\(regularFeedIndex\.current\)/);
assert.match(demo, /onPress=\{\(\) => openSavedCollection\(collection\)\}/);
assert.match(demo, /onPress=\{\(\) => selectRootTab\("Explore"\)\}/);
assert.match(demo, /paddingBottom: bottomReserve/);
assert.match(demo, /bottom: bottomReserve/);
assert.match(demo, /bottomInset=\{insets\.bottom\}/);
assert.doesNotMatch(demo, /style=\{\[styles\.nav,/);
assert.match(demo, /"Fictional"|FICTIONAL CONTENT/);
assert.match(offline, /approve_free_demo_build/);
assert.match(ci, /ux004-a12-navigation-contract\.cjs/);
assert.match(apk, /ux004-a12-navigation-contract\.cjs/);
assert.match(app, /if \(demo\) return <DemoExperience \/>/);
assert.match(metro, /config\.resolver\.resolveRequest/);
for(const [name,source] of Object.entries({tabBar,navTypes,controller})){
 assert.doesNotMatch(source,/\bfetch\s*\(|axios|createClient\(|getSupabase\(|mobileApi\.|Paystack|DATABASE_URL|https?:\/\//i, name+" must remain offline");
}
console.log("PASS: UX004-A1.2 fixed nav order, Create action, root-state and feed restoration, insets and no API/build changes");
