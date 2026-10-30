#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module"),ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(p){
 const file=path.join(root,p),instance=new Module(file,module);
 instance.filename=file;instance.paths=Module._nodeModulePaths(path.dirname(file));
 instance._compile(ts.transpileModule(source(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
 return instance.exports;
}
const commerce=source("apps/web/lib/commerce.ts");
const shared=source("apps/web/lib/api/authenticated-fetch.ts");
const ctrl=source("apps/api/src/commerce/commerce.controller.ts");
assert.match(commerce,/import \{ authenticatedFetch \} from "\.\/api\/authenticated-fetch";/);
assert.doesNotMatch(commerce,/getSupabaseBrowserClient|getSession\(|NEXT_PUBLIC_API_URL|const apiBase/);
assert.match(shared,/await stagingSession\(\)/);
assert.match(shared,/credentials: isolatedWebMode \? "same-origin"/);
assert.match(ctrl,/@Controller\("cart"\)\s*@UseGuards\(AuthGuard\)/);
const proxy=load("apps/web/lib/api/isolated-web-proxy.ts");
const api=load("apps/api/src/staging-request-policy.ts");
const allowed=[
 ["GET","cart"],["POST","cart/items"],
 ["PUT","cart/items/item-1"],["DELETE","cart/items/item-1"],["DELETE","cart"]
];
for(const [verb,route] of allowed) {
 const target="api/v1/"+route;
 assert.equal(proxy.stagingProxyAllowed(verb,target.split("/")),true,"proxy allows "+verb+" "+route);
 assert.equal(api.stagingRequestAllowed(verb,"/"+target),true,"API allows "+verb+" "+route);
}
const denied=[
 ["POST","cart/checkout"],["POST","cart/checkout/preview"],["GET","cart/checkout/preview"],
 ["POST","orders"],["POST","orders/order-1/pay"],["POST","payments/initialize"],
 ["POST","wallet/deposit"],["PUT","cart"],["PATCH","cart/items/item-1"],
 ["GET","cart/items/item-1"],["POST","cart/items/item-1"],
 ["DELETE","cart/checkout"],["POST","live"],["POST","live/id-1/start"]
];
for(const [verb,route] of denied) {
 const target="api/v1/"+route;
 assert.equal(proxy.stagingProxyAllowed(verb,target.split("/")),false,"proxy denies "+verb+" "+route);
 assert.equal(api.stagingRequestAllowed(verb,"/"+target),false,"API denies "+verb+" "+route);
}
const livePage=source("apps/web/app/live/page.tsx");
const liveCard=source("apps/web/components/live/live-preview-card.tsx");
const liveCSS=source("apps/web/app/live/live.module.css");
const feed=source("apps/web/app/home/page.tsx");
assert.match(livePage,/data-hustle-live-previews="true"/);
assert.match(livePage,/getActiveLiveSessions\(30\)/);
assert.match(livePage,/className=\{styles\.livePreviewFeed\}/);
assert.match(livePage,/<LivePreviewCard session=\{item\}/);
assert.doesNotMatch(livePage,/getLiveComments|createLiveComment|viewerMediaControls/);
assert.match(liveCard,/encodeURIComponent\(session\.id\)/);
assert.match(liveCard,/session\.pinnedProduct \?\? session\.pinnedService/);
assert.match(liveCard,/formatLiveMoney\(offer\.priceMinor, offer\.currency\)/);
assert.match(liveCard,/session\.media\?\.playbackUrl \?\? session\.playbackUrl/);
assert.match(liveCard,/muted autoPlay playsInline loop preload="metadata"/);
assert.doesNotMatch(liveCard,/createLiveComment|heartbeatLiveViewer|recordLiveEvent/);
assert.match(liveCSS,/scroll-snap-type:y mandatory/);
assert.match(feed,/import \{ LivePreviewCard \}/);
assert.match(feed,/getActiveLiveSessions\(12\)/);
assert.match(feed,/tab === "nearby"/);
assert.match(feed,/tab === "connections"/);
assert.match(feed,/followed\.has\(session\.hostUserId\)/);
assert.match(feed,/blendedFeed\.map\(\(entry, index\)/);
assert.match(feed,/<LivePreviewCard session=\{entry\.live\} context="discovery"/);
console.log("PASS UX033: real post and LIVE mixed feed, live-only previews, authenticated nonfinancial Cart.");
