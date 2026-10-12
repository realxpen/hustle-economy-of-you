#!/usr/bin/env node
// Static guardrails: browser/device testing is required separately.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname,"../..");
const read = (p) => fs.readFileSync(path.join(root,p),"utf8");
const foundation = read("apps/web/app/adaptive-foundation.css");
const layout = read("apps/web/app/layout.tsx");
assert.match(layout,/import "\.\/adaptive-foundation\.css";/);
assert.match(foundation,/max-width:760px/);
assert.match(foundation,/font-size:\s*(?:max\(16px|16px)/);
assert.match(foundation,/prefers-reduced-motion:reduce/);
assert.doesNotMatch(layout+foundation,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/i);
const routes=["home","search","marketplace","messages","notifications","wallet","bookings","orders","cart","checkout","live","stories","agent-application","agent-workspace","hustler-application","professional-profile"];
for(const route of routes)assert.ok(fs.existsSync(path.join(root,"apps/web/app",route,"page.tsx")),"Missing route "+route);
const modules=[
 "apps/web/app/home/page.module.css","apps/web/app/search/search.module.css",
 "apps/web/app/commerce.module.css","apps/web/app/bookings/bookings.module.css",
 "apps/web/app/messages/messages.module.css","apps/web/app/notifications/notifications.module.css",
 "apps/web/app/live/live.module.css","apps/web/app/agents/page.module.css",
 "apps/web/app/services/[serviceId]/page.module.css",
 "apps/web/app/products/[productId]/page.module.css",
 "apps/web/app/u/[username]/page.module.css",
 "apps/web/components/navigation/experience-header.module.css",
 "apps/web/components/navigation/hustle-mobile-nav.module.css"
];
for(const path of modules){
 const content=read(path);
 assert.match(content,/@media\s*\(/,"Responsive rules missing: "+path);
 assert.match(content,/min-width:\s*0|minmax\(0,|min\(100%/,"Shrinkable content missing: "+path);
}
const nav=read("apps/web/components/navigation/hustle-mobile-nav.tsx");
for(const href of ["/home","/search","/marketplace","/messages","/notifications","/account"]){
 assert.ok(nav.includes('href: "'+href+'"'),"Missing canonical nav route "+href);
}
assert.match(read("apps/web/components/navigation/hustle-mobile-nav.module.css"),/grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/);
assert.match(read("apps/web/app/home/page.module.css"),/scroll-snap-type:\s*y mandatory/);
assert.match(read("apps/web/app/home/page.module.css"),/var\(--post-footer-height/);
const discoverCss=read("apps/web/app/home/page.module.css");
assert.match(discoverCss,/@media\(max-width:760px\) and \(max-height:600px\) and \(orientation:landscape\)/,"Short-height horizontal rail must be landscape only");
assert.match(discoverCss,/orientation:portrait/,"Portrait rail layout must be explicit");
assert.match(discoverCss,/\.cardBodyOffersOpen/,"Expanded offer footer needs bounded layout");
assert.match(discoverCss,/\.cardBodyOffersOpen[\s\S]*?\.opportunityBlock/,"Offer list must scroll within footer");
const themeCss=read("apps/web/components/navigation/experience-theme-control.module.css");
assert.match(themeCss,/max-width:none!important/,"Theme selection must not clip System at iOS font scale");
const discoverSource=read("apps/web/app/home/page.tsx");
assert.match(discoverSource,/compactActions/,"Post needs measured-space action fallback");
assert.match(discoverSource,/footerRect\.top\s*-\s*cardRect\.top/,"Action compactness must depend on real footer placement");
assert.match(discoverSource,/aria-controls=\{"post-actions-"/,"Compact action disclosure must control the real actions");
assert.match(discoverCss,/\.actionRail\.railCompact/,"Compact action menu must have a defined bounded layout");
assert.match(discoverCss,/\.actionRail\.railCompactClosed/,"Collapsed rail must not intercept touches");
const headerCss=read("apps/web/components/navigation/experience-header.module.css");
const dockCss=read("apps/web/components/navigation/hustle-mobile-nav.module.css");
assert.match(discoverCss,/Mobile Discover ships COMPACT by default/,"Mobile Discover must use first-paint compact style");
assert.match(headerCss,/Mobile-first compact chrome on the very first render/,"Mobile header must use first-paint compact style");
assert.match(dockCss,/Compact six-destination dock on first paint/,"Six-route dock must use compact style");
assert.doesNotMatch(discoverCss+headerCss+dockCss,/\b(?:zoom\s*:\s*0\.5|transform\s*:\s*scale\(0\.5\))/i,"Never simulate 50% website zoom with transforms");

assert.match(discoverCss,/Desktop Discover workbench/,"Wide-screen Discover workbench must be defined");
assert.match(discoverCss,/@media \(min-width:1120px\) and \(min-height:650px\)/,"Wide desktop layout needs an explicit breakpoint");
assert.match(discoverCss,/--desktop-context-width:clamp\(/,"Live post context must have bounded width");
assert.match(discoverCss,/\.postCanvas\{\s*inset:0 auto 0 0;/,"Media must occupy the left desktop stage");
assert.match(discoverCss,/\.cardBody\{\s*top:0;\s*bottom:0;\s*left:auto;/,"Existing creator and attached-offer details must use the right pane");
assert.match(discoverCss,/\.desktopContextLabel\{display:none\}/,"Mobile must not inherit desktop detail heading");
assert.match(discoverCss,/@media \(min-width:761px\) and \(max-width:1119px\)/,"Tablet/zoom layout must remain single-stage");
assert.match(discoverCss,/prefers-reduced-transparency:reduce/,"Desktop glass must have opaque fallback");
assert.match(discoverSource,/<div className=\{styles.postCanvas\}>[\s\S]*?<\/div>\s*<\/div>\s*<div ref=\{footerRef\}/,
  "One existing post body must be a sibling of the media canvas, allowing desktop context without duplication");
assert.match(discoverSource,/<div className=\{styles.desktopContextLabel\} aria-hidden="true">/);
assert.match(discoverSource,/OfferQuickView type="SERVICE"/);
assert.match(discoverSource,/OfferQuickView type="PRODUCT"/);

assert.match(discoverSource,/window\.matchMedia\("\(min-width: 1120px\) and \(min-height: 650px\)"\)/,
  "Desktop offer expansion should only activate in the wide context layout");
assert.match(discoverSource,/setOffersOpen\(desktop\.matches && \(item\.services\.length \+ item\.products\.length\) > 0\)/,
  "Only actual API-backed offers should auto-expand on desktop");
assert.match(discoverSource,/desktop\.addEventListener\("change", syncOfferVisibility\)/,
  "Desktop-to-mobile transitions must restore collapsed mobile offer behavior");
assert.match(discoverCss,/\.opportunityDock\{\s*margin-top:0;\s*padding-top:14px;/,
  "Desktop offer section belongs directly below caption and tags");
assert.match(discoverCss,/\.opportunityBlock\{\s*margin-top:10px;\s*padding:0;\s*max-height:none;\s*overflow:visible;/,
  "Long desktop offer lists must use the context panel scroll instead of a nested scroller");
assert.match(discoverCss,/\.opportunityCard>span\{color:var\(--h-ink\)\}/,
  "Actual price labels need readable desktop glass colors");





console.log("Adaptive Web contract OK: "+routes.length+" routes and "+modules.length+" style modules.");
