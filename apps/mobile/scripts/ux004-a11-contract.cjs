#!/usr/bin/env node
// UX004-A1.1 static safeguard: no server access, build credits or extra packages.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
const colors = read("src/ux004/theme/colors.ts");
const surfaces = read("src/ux004/components/HybridScreenSurface.tsx");
const demo = read("src/experience/DemoExperience.tsx");
const disclosure = read("src/ux004/components/DemoDisclosure.tsx");
const pressable = read("src/ux004/components/TactilePressable.tsx");
const icon = read("src/ux004/components/AppIcon.tsx");
const layout = read("src/ux004/theme/layout.ts");
const app = read("App.tsx");
const metro = read("metro.config.js");
const spec = fs.readFileSync(path.join(root, "../../Knowledge/UX/HUSTLE_UX004_A1_DESIGN_SYSTEM_NAVIGATION_SPEC.md"), "utf8");

function fromHex(hex) {
  const n = hex.replace("#", "");
  assert.match(n, /^[0-9a-f]{6}$/i);
  return [0,2,4].map(i => parseInt(n.slice(i,i+2),16) / 255);
}
function luminance(hex) {
  const [r,g,b] = fromHex(hex).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return .2126*r + .7152*g + .0722*b;
}
function contrast(a,b) {
  const [x,y] = [luminance(a),luminance(b)].sort((a,b) => b-a);
  return (x+.05)/(y+.05);
}
function color(name) {
  const m=colors.match(new RegExp("\\b"+name+": \"(#[0-9a-fA-F]{6})\""));
  assert.ok(m, "Missing UX004 semantic token: "+name);
  return m[1];
}
assert.match(spec, /Hybrid — dark immersive Feed and future Live/i);
assert.ok(contrast(color("textPrimaryLight"),color("paper"))>=4.5);
assert.ok(contrast(color("textSecondaryLight"),color("paper"))>=4.5);
assert.ok(contrast(color("textPrimaryDark"),color("ink"))>=4.5);
assert.ok(contrast(color("lime"),color("ink"))>=4.5);
assert.match(colors, /darkFeed: colors\.ink/);
assert.match(colors, /lightUtility: colors\.paper/);
assert.match(demo, /HybridScreenSurface mode=\{screen === "Home" \? "darkFeed" : "lightUtility"\}/);
assert.match(demo, /import \{ AppIcon, type AppIconName \}/);
assert.ok(demo.includes('<DemoDisclosure compact label={DEMO_BANNER}'), 'Demo disclosure stays visible');
assert.ok(demo.includes('<TactilePressable accessibilityLabel={title}'), 'Primary CTA must use tactile primitive');
assert.match(demo, /import \{ useDemoNavigation \} from "\.\.\/ux004\/navigation\/useDemoNavigation"/);
assert.match(demo, /onPressCreate=\{\(\) => Alert\.alert\("Create · Demo"/);
assert.match(demo, /EXPO|FICTIONAL CONTENT/i);
assert.match(disclosure, /accessibilityLabel=\{label\}/);
assert.match(disclosure, /fontSize: typography\.label/);
assert.match(pressable, /minHeight: layout\.minTapTarget/);
assert.match(layout, /minTapTarget: 48/);
assert.match(icon, /from "@expo\/vector-icons"/);
assert.match(surfaces, /surfaceColors\[mode\]/);
assert.match(app, /if \(demo\) return <DemoExperience/);
assert.match(metro, /config\.resolver\.resolveRequest/);
for(const src of [colors, surfaces, disclosure,pressable,icon]){
  assert.doesNotMatch(src, /\bfetch\(|createClient\(|mobileApi\.|PAYSTACK|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL/,
    "A1.1 shared UI must be backend-free");
}
console.log("PASS: UX004-A1.1 Hybrid roles, >=4.5:1 static text pairings, local demo wiring and no backend/dependency changes");
