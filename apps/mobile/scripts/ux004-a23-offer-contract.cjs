#!/usr/bin/env node
/**
 * UX004-A2.3: pure offer copy behavior + static dark Feed semantics checks.
 * Does not claim actual Android layout, accessibility or device acceptance.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");
const base = path.resolve(root, "../..");
const rootRead = p => fs.readFileSync(path.join(base, p), "utf8");
const offerPath = path.join(root, "src/ux004/feed/demoOfferCopy.ts");
const source = fs.readFileSync(offerPath, "utf8");
const moduleData = ts.transpileModule(source, { compilerOptions: {
  target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, strict: true,
}});
const localModule = new Module(offerPath, module);
localModule.filename = offerPath;
localModule.paths = Module._nodeModulePaths(path.dirname(offerPath));
localModule._compile(moduleData.outputText, offerPath);
const { getDemoOfferCopy } = localModule.exports;
const demo = read("src/experience/DemoExperience.tsx");
const component = read("src/ux004/feed/FeedOfferAttachment.tsx");
const a1 = read("scripts/ux004-a14-integration-audit.cjs");
const a21 = read("scripts/ux004-a21-feed-contract.cjs");
const a22 = read("scripts/ux004-a22-social-contract.cjs");
const ci = rootRead(".github/workflows/mobile-cloud-validation.yml");
const manual = rootRead(".github/workflows/hustle-offline-android-demo.yml");
const qa = rootRead("Knowledge/QA/HUSTLE_UX004_A23_FEED_OFFER_MEDIA.md");
function check(name, fn) { fn(); console.log("PASS: " + name); }

check("Pure offer copy differentiates service preview and product preview", () => {
 const service = getDemoOfferCopy("service");
 const product = getDemoOfferCopy("product");
 assert.equal(service.badge, "SAMPLE SERVICE");
 assert.equal(product.badge, "SAMPLE PRODUCT");
 assert.equal(service.action, "View service");
 assert.equal(product.action, "View product");
 assert.match(service.noTransaction, /no booking is made/i);
 assert.match(product.noTransaction, /no purchase is made/i);
 assert.notDeepEqual(service, product);
});
check("Feed offer card is accessible and leads to preview only", () => {
 assert.match(component, /kind: DemoOfferKind/);
 assert.match(component, /getDemoOfferCopy\(kind\)/);
 assert.match(component, /accessibilityRole="button"/);
 assert.match(component, /accessibilityLabel=\{copy\.action \+ ": " \+ title/);
 assert.match(component, /accessibilityHint=\{copy\.noTransaction\}/);
 assert.match(component, /numberOfLines=\{2\}/);
 assert.match(component, /minHeight: layout\.minTapTarget/);
 assert.match(component, /SAMPLE SERVICE|copy\.badge/);
 assert.match(component, /onPress=\{onPress\}/);
 assert.match(component, /pressed && styles\.pressed/);
 assert.doesNotMatch(component, /\bfetch\s*\(|axios|createClient|useEffect|BackHandler|payments|checkout|Paystack/i);
});
check("Poster is explicitly illustrated and no fake video is claimed", () => {
 assert.match(demo, /ILLUSTRATED DEMO · \{post\.category\.toUpperCase\(\)\}/);
 assert.match(demo, /Illustrated sample, not real video/);
 assert.match(demo, /posterFoot: \{ color: "#FFFFFF", fontSize: 12/);
 assert.match(demo, /styles\.posterType, \{ top: insets\.top \+ 164 \}/);
 assert.match(demo, /styles\.demoChip, \{ top: insets\.top \+ 113 \}/);
 assert.match(demo, /styles\.artworkTapTarget/);
 assert.doesNotMatch(demo, /VideoView|useVideoPlayer|autoplay|requestCameraPermissionsAsync/);
});
check("Attached offer preserves original creator, rail, feed and preview navigation", () => {
 assert.match(demo, /import \{ FeedOfferAttachment \} from/);
 assert.match(demo, /<FeedOfferAttachment kind=\{post\.offer\.kind\} title=\{post\.offer\.title\}/);
 assert.match(demo, /price=\{post\.offer\.price\} creatorName=\{post\.name\}/);
 assert.match(demo, /onPress=\{\(\) => open\("offer", post\)\}/);
 assert.match(demo, /Sample offer only\. No real provider, inventory, checkout, payment or escrow/);
 assert.match(demo, /No real availability is checked and no booking will be created/);
 assert.match(demo, /Shopping and checkout are disabled in this demo/);
 assert.match(demo, /Preview request \(not sent\)/);
 assert.match(demo, /returnToForYou/);
 assert.match(demo, /onArtworkTap\(post\.id\)/);
 assert.match(a1, /A1 owner acceptance preserved/);
 assert.match(a21, /Double-tap policy applies only to the same post/);
 assert.match(a22, /thread order groups roots with direct replies/);
});
check("Cloud checks precede any separately approved APK, no device pass inferred", () => {
 assert.match(ci, /node apps\/mobile\/scripts\/ux004-a23-offer-contract\.cjs/);
 assert.match(manual, /node apps\/mobile\/scripts\/ux004-a23-offer-contract\.cjs/);
 assert.match(manual, /workflow_dispatch:/);
 assert.match(manual, /if: inputs\.approve_free_demo_build == true/);
 assert.ok(manual.indexOf("ux004-a23-offer-contract.cjs") < manual.indexOf("eas build --platform android"));
 assert.match(qa, /Device acceptance: PENDING/);
 assert.match(qa, /No Expo build/);
});
console.log("UX004-A2.3 contract PASS; Android rendering/interaction remain unverified.");
