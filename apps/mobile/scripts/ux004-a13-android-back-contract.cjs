#!/usr/bin/env node
// UX004-A1.3: no-cost static safety contract. Device Back/IME still needs real QA.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const base = path.resolve(__dirname,"..");
const read = (p)=>fs.readFileSync(path.join(base,p),"utf8");
const source=read("src/experience/DemoExperience.tsx");
const chrome=read("src/ux004/components/SheetChrome.tsx");
const back=read("src/ux004/navigation/useDemoAndroidBack.ts");
const tab=read("src/ux004/components/FloatingTabBar.tsx");
const nav=read("src/ux004/navigation/useDemoNavigation.ts");
const app=read("App.tsx");
const metro=read("metro.config.js");
const ci=fs.readFileSync(path.join(base,"../../.github/workflows/mobile-cloud-validation.yml"),"utf8");
const eas=fs.readFileSync(path.join(base,"../../.github/workflows/hustle-offline-android-demo.yml"),"utf8");

assert.match(back, /BackHandler\.addEventListener\("hardwareBackPress"/);
assert.match(back, /subscription\.remove\(\)/);
assert.match(back, /Keyboard\.addListener\("keyboardDidShow"/);
assert.match(back, /Keyboard\.addListener\("keyboardDidHide"/);
assert.match(back, /opened\.remove\(\); closed\.remove\(\)/);
assert.match(back, /if \(sheetOpen\) return false;/);
assert.match(back, /Keyboard\.isVisible\(\) \|\| keyboardVisible/);
assert.match(back, /Keyboard\.dismiss\(\);\s*return true;/);
assert.match(back, /if \(activeTab !== "Home"\)/);
assert.match(back, /onNavigateHome\(\);/);
assert.match(back, /return false;\s*}\);/);
assert.match(source, /const \{ keyboardVisible \} = useDemoAndroidBack\(/);
assert.match(source, /const goHome = useCallback\(\(\) => selectRootTab\("Home"\)/);
assert.match(source, /onNavigateHome: goHome/);
assert.match(source, /const requestDismissSheet = \(\) => \{/);
assert.match(source, /Keyboard\.isVisible\(\) \|\| keyboardVisible/);
assert.match(source, /onRequestClose=\{requestDismissSheet\}/);
assert.match(source, /onPress=\{requestDismissSheet\}/);
assert.match(source, /keyboardShouldPersistTaps="handled"/);
assert.match(source, /<ScrollView style=\{styles\.sheetScroll\} nestedScrollEnabled/);
assert.match(source, /contentContainerStyle=\{\{ paddingTop: insets\.top \+ 27, paddingBottom: bottomReserve \}\}/);
assert.match(source, /screen === "Inbox" \? <View style=\{\[styles\.lightPage, styles\.centerPage,/);
assert.match(source, /\{!keyboardVisible && <FloatingTabBar/);
// UX011 passes the established close hitbox into the shared sheet header.
assert.match(source, /closeStyle=\{styles\.sheetCloseTarget\}/);
assert.match(chrome, /style=\{\(\{ pressed \}\) => \[styles\.close, closeStyle,/);
assert.match(chrome, /minHeight: layout\.minTapTarget/);
assert.match(source, /style=\{styles\.sendTarget\}/);
assert.match(source, /onSubmitEditing=\{addComment\}/);
assert.match(source, /minHeight: layout\.minTapTarget/);
assert.match(source, /setSheet\(null\)/);
assert.match(source, /OFFLINE DEMO · NO BACKEND · NO TRANSACTIONS/);
assert.match(tab, /onPressCreate/);
assert.match(nav, /RootTab/);
assert.match(app, /if \(demo\) return <DemoExperience \/>/);
assert.match(metro, /config\.resolver\.resolveRequest/);
assert.match(ci, /ux004-a13-android-back-contract\.cjs/);
assert.match(eas, /ux004-a13-android-back-contract\.cjs/);
for (const [name,data] of Object.entries({back,tab})) {
  assert.doesNotMatch(data,/\bfetch\s*\(|createClient\s*\(|mobileApi\.|PAYSTACK|DATABASE_URL|\bEAS_TOKEN\b/,
    name+" must not access a backend or a paid service");
}
console.log("PASS: UX004-A1.3 modal keyboard-first Back, root tab Back, cleanup, safe-area and 48dp input actions");
