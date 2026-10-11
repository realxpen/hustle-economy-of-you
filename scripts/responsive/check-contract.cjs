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

console.log("Adaptive Web contract OK: "+routes.length+" routes and "+modules.length+" style modules.");
