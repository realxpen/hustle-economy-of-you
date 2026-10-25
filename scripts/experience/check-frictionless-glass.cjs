#!/usr/bin/env node
// Static UX invariants: page chrome, route handoff, contrast and reduced-transparency.
// NOT a replacement for real signed-in iPhone Safari or touch UX acceptance.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=(p)=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");
const layout=read("apps/web/app/layout.tsx");
const home=read("apps/web/app/home/page.tsx");
const homeCss=read("apps/web/app/home/page.module.css");
const header=read("apps/web/components/navigation/experience-header.module.css");
const dock=read("apps/web/components/navigation/hustle-mobile-nav.module.css");
const nav=read("apps/web/components/navigation/hustle-mobile-nav.tsx");
const glass=read("apps/web/app/glass-system.css");
const quick=home.split('<div className={styles.quickLinks}>')[1]?.split('</div>')[0];
assert.ok(quick,"Discover quick actions must exist");
assert.match(quick,/href="\/stories"/,"Stories available in Discover");
assert.match(quick,/href="\/posts\/new"/,"Create opens composer without extra management step");
assert.doesNotMatch(quick,/href="\/search"/,"Discover must not duplicate dock Search");
assert.match(quick,/href="\/wallet"/,"Discover must expose Sandbox Wallet directly");
assert.equal((quick.match(/<Link /g)||[]).length,3,"Three focused actions: Wallet, Story and Create");
assert.match(nav,/href: "\/search"/,"Canonical global Search remains reachable");
assert.match(dock,/repeat\(6,minmax\(0,1fr\)\)/,"Six-route dock unchanged");
assert.match(homeCss,/\.quickLinks a\{width:44px;height:44px/,"Quick actions meet minimum touch target");
assert.match(header,/\.contextRow:not\(:has\(\.crumb\)\):not\(:has\(\.localNav\)\)/,"Hide redundant root breadcrumb on mobile");
assert.match(layout,/import "\.\/glass-system\.css"/,"Glass foundation imported globally");
for(const value of ["--h-glass-fill","--h-glass-raised","--h-glass-outline","--h-glass-blur"]){
  assert.ok(glass.includes(value),"Glass token missing "+value);
}
assert.match(glass,/prefers-reduced-transparency:reduce/,"Offer opaque fallback for users reducing transparency");
assert.match(glass,/not\(\.h-discover-immersive\)/,"Keep actual Discover media unobscured");
assert.match(glass,/main\.h-adaptive/,"Dark/light adaptive routes supported");
const surfaces=[
"apps/web/app/search/search.module.css",
"apps/web/app/commerce.module.css",
"apps/web/app/bookings/bookings.module.css",
"apps/web/app/messages/messages.module.css",
"apps/web/app/notifications/notifications.module.css",
"apps/web/app/services/[serviceId]/page.module.css",
"apps/web/app/products/[productId]/page.module.css",
"apps/web/app/u/[username]/page.module.css",
"apps/web/app/account/page.module.css",
"apps/web/app/professional-profile/page.module.css",
"apps/web/app/agents/page.module.css",
"apps/web/app/stories/stories.module.css",
"apps/web/app/live/live.module.css",
"apps/web/app/posts/[postId]/page.module.css",
"apps/web/app/hustler-application/page.module.css",
"apps/web/components/commerce/offer-quick-view.module.css",
"apps/web/components/commerce/transaction-journey.module.css",
"apps/web/components/navigation/hustle-mobile-nav.module.css",
"apps/web/components/navigation/experience-header.module.css"
];
for(const name of surfaces){
 const css=read(name);
 assert.match(css,/backdrop-filter/,"Glass surface missing: "+name);
 assert.match(css,/prefers-reduced-transparency:reduce/,"Opaque fallback missing: "+name);
}
assert.doesNotMatch(glass+homeCss,/user-scalable\s*=\s*no|maximum-scale\s*=\s*1|zoom\s*:\s*0\.5/i,"Never force browser zoom");
assert.match(read("apps/web/components/navigation/experience-header.tsx"),/href: "\/search"/,"Desktop Search stays reachable");
console.log("Frictionless Glass contract OK: unique Discover search, direct Create and "+surfaces.length+" shared surface checks.");
