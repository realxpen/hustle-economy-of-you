#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const root=path.resolve(__dirname,"../..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(p){
  const file=path.join(root,p);
  const instance=new Module(file,module);
  instance.filename=file;
  instance.paths=Module._nodeModulePaths(path.dirname(file));
  instance._compile(ts.transpileModule(source(p),{compilerOptions:{
    module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
  }}).outputText,file);
  return instance.exports;
}
const lib=source("apps/web/lib/live.ts");
const page=source("apps/web/app/live/page.tsx");
const css=source("apps/web/app/live/live.module.css");
const publicApi=source("apps/web/lib/api/public-browsing.ts");
assert.match(lib,/import \{ publicReadFetch \} from "\.\/api\/public-browsing"/);
assert.match(lib,/await publicReadFetch\(\x60\/live\?limit=\$\{limit\}\x60\)/);
assert.match(lib,/await publicReadFetch\(\x60\/live\/\$\{encodeURIComponent\(liveId\)\}\x60\)/);
assert.match(lib,/await publicReadFetch\(\s*\x60\/live\/\$\{encodeURIComponent\(liveId\)\}\/comments\?\$\{params\.toString\(\)\}\x60/);
assert.match(publicApi,/isolatedWebMode \? \x60\/api\/isolated\/api\/v1\$\{path\}\x60/);
assert.match(page,/getActiveLiveSessions\(30\)/);
assert.match(page,/setReload\(value=>value\+1\)/);
assert.match(page,/item\.host\.username \? \x60@\$\{item\.host\.username\}\x60/);
assert.doesNotMatch(page,/item\.host\.username \?\? "hustler"/);
assert.match(css,/\.heroPanel\{padding:15px 16px;border-radius:17px/);
const proxy=load("apps/web/lib/api/isolated-web-proxy.ts");
const backend=load("apps/api/src/staging-request-policy.ts");
const allow=[
 ["GET","live"],["GET","live/active-1"],["GET","live/active-1/comments"]
];
for(const [verb,p] of allow){
  assert.equal(proxy.stagingProxyAllowed(verb,("api/v1/"+p).split("/")),true,"Worker should read "+p);
  assert.equal(backend.stagingRequestAllowed(verb,"/api/v1/"+p),true,"API should read "+p);
}
const deny=[
 ["GET","live/mine"],["GET","live/mine/active-1"],
 ["GET","live/active-1/media"],["GET","live/active-1/media/publish-token"],
 ["GET","live/active-1/control"],["GET","live/active-1/comments/private"],
 ["POST","live"],["POST","live/active-1/start"],["POST","live/active-1/end"],
 ["POST","live/active-1/media/publish-token"],
 ["POST","live/active-1/media/view-token"],
 ["POST","live/active-1/media/presence"],
 ["POST","live/active-1/view"],["POST","live/active-1/view/leave"],
 ["POST","live/active-1/comments"],
 ["POST","live/active-1/pin"],["POST","live/active-1/events"],
 ["PATCH","live/active-1"],["DELETE","live/active-1"],
 ["POST","orders"],["POST","wallet/deposit"],["POST","payments/initialize"]
];
for(const [verb,p] of deny){
 assert.equal(proxy.stagingProxyAllowed(verb,("api/v1/"+p).split("/")),false,"Worker should deny "+verb+" "+p);
 assert.equal(backend.stagingRequestAllowed(verb,"/api/v1/"+p),false,"API should deny "+verb+" "+p);
}
console.log("PASS UX032: public Live GETs resolve through isolated PWA; streaming and commerce writes remain disabled.");
