#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),Module=require("node:module");
const ts=require("typescript"),YAML=require("yaml");
const root=path.resolve(__dirname,"../..");
const get=p=>fs.readFileSync(path.join(root,p),"utf8");
const proxyPath="apps/web/lib/api/isolated-web-proxy.ts";
const file=path.join(root,proxyPath),mod=new Module(file,module);
mod.filename=file;mod.paths=Module._nodeModulePaths(path.dirname(file));
mod._compile(ts.transpileModule(get(proxyPath),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
}}).outputText,file);
const proxy=mod.exports;
const VERCEL="https://hustle-isolated-staging-api.vercel.app";
const AWS="https://hh2zi77ntrsjj3rgapko7rsjv40ztgpu.lambda-url.eu-west-2.on.aws";
const keys=["HUSTLE_API_BACKEND_TARGET","HUSTLE_ISOLATED_PWA_GATE","NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH"];
const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));

async function main(){
  const originalFetch=global.fetch;
  try{
    // The already-deployed worker has no backend target binding. It must
    // continue to use Vercel and never silently switch to AWS.
    delete process.env.HUSTLE_API_BACKEND_TARGET;
    assert.equal(proxy.selectedIsolatedBackendOrigin(),VERCEL);
    process.env.HUSTLE_API_BACKEND_TARGET="vercel-isolated-staging";
    assert.equal(proxy.selectedIsolatedBackendOrigin(),VERCEL);
    process.env.HUSTLE_API_BACKEND_TARGET="aws-lambda-isolated-staging";
    assert.equal(proxy.selectedIsolatedBackendOrigin(),AWS);
    process.env.HUSTLE_API_BACKEND_TARGET="https://attacker.test";
    assert.equal(proxy.selectedIsolatedBackendOrigin(),null,"arbitrary URL must be rejected");
    process.env.HUSTLE_API_BACKEND_TARGET="aws-lambda-isolated-staging";
    process.env.HUSTLE_ISOLATED_PWA_GATE="isolated-staging";
    process.env.NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH="true";
    const seen=[];
    global.fetch=async(url,options)=>{
      seen.push({url:String(url),method:options.method,origin:options.headers.get("origin"),
        cookie:options.headers.get("cookie"),authorization:options.headers.get("authorization")});
      return new Response('{"ok":true}',{
        status:200,headers:{"content-type":"application/json",
          "set-cookie":"hustle-staging.session_token=staging-only; Domain=hh2zi77ntrsjj3rgapko7rsjv40ztgpu.lambda-url.eu-west-2.on.aws; Path=/api; Secure; HttpOnly"}
      });
    };
    const seg=p=>p.split("/");
    const req=(method,origin="https://preview.example",body="{}")=>({
      method,headers:new Headers({"origin":origin,"content-type":"application/json",
        "cookie":"hustle-staging.session_token=fixture; other_prod_cookie=blocked",
        authorization:"Bearer test-preview-token"}),
      nextUrl:{origin:"https://preview.example",searchParams:new URLSearchParams({limit:"4",target:"unsafe"})},
      text:async()=>body
    });
    assert.equal((await proxy.proxyIsolatedRequest(req("GET"),seg("api/v1/health"))).status,200);
    assert.equal(seen[0].url,AWS+"/api/v1/health?limit=4");
    assert.equal(seen[0].cookie,"hustle-staging.session_token=fixture");
    assert.equal(seen[0].authorization,"Bearer test-preview-token");
    assert.equal((await proxy.proxyIsolatedRequest(req("GET"),seg("auth/get-session"))).status,200);
    assert.equal(seen[1].url,AWS+"/api/auth/get-session");
    const login=await proxy.proxyIsolatedRequest(req("POST"),seg("auth/sign-in/email"));
    assert.equal(login.status,200);
    assert.equal(seen[2].origin,AWS,"Better Auth Origin must equal its exact Lambda issuer");
    const cookie=login.headers.get("set-cookie")||"";
    assert.match(cookie,/hustle-staging\.session_token=/);
    assert.doesNotMatch(cookie,/Domain=/i);
    assert.match(cookie,/Path=\//);
    const existingCalls=seen.length;
    assert.equal((await proxy.proxyIsolatedRequest(req("POST","https://evil.test"),seg("auth/sign-in/email"))).status,403);
    assert.equal((await proxy.proxyIsolatedRequest(req("POST"),seg("api/v1/payments/initialize"))).status,403);
    assert.equal(seen.length,existingCalls,"rejected requests cannot reach AWS");
    process.env.HUSTLE_API_BACKEND_TARGET="http://localhost:4000";
    assert.equal((await proxy.proxyIsolatedRequest(req("GET"),seg("api/v1/health"))).status,503);
    assert.equal(seen.length,existingCalls,"unknown targets cannot reach fetch");
    process.env.HUSTLE_API_BACKEND_TARGET="vercel-isolated-staging";
    assert.equal((await proxy.proxyIsolatedRequest(req("GET"),seg("api/v1/health"))).status,200);
    assert.equal(seen.at(-1).url,VERCEL+"/api/v1/health?limit=4");
  }finally{
    global.fetch=originalFetch;
    for(const [k,v] of Object.entries(saved))
      if(v===undefined)delete process.env[k];else process.env[k]=v;
  }

  // Execute the Worker config under both build flags: a mere source string
  // match is insufficient protection against overwriting the current Worker.
  const configFile=path.join(root,"apps/web/cloudflare.config.ts");
  const configSource=get("apps/web/cloudflare.config.ts");
  const runConfig=(awsFlag,cutoverFlag=false)=>{
    const original=process.env.HUSTLE_AWS_PREVIEW_BUILD;
    const originalCutover=process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD;
    if(awsFlag)process.env.HUSTLE_AWS_PREVIEW_BUILD="true";
    else delete process.env.HUSTLE_AWS_PREVIEW_BUILD;
    if(cutoverFlag)process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD="true";
    else delete process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD;
    try{
      const cm=new Module(configFile,module);
      cm.filename=configFile;
      cm.paths=Module._nodeModulePaths(path.dirname(configFile));
      cm.require=(name)=>{
        if(name!=="cf/config")throw Error("Unexpected config dependency: "+name);
        return {
          bindings:{assets:()=>({type:"assets"}),images:()=>({type:"images"}),text:v=>v},
          defineConfig:v=>v,defineWorker:v=>v
        };
      };
      cm._compile(ts.transpileModule(configSource,{compilerOptions:{
        module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022
      }}).outputText,configFile);
      return cm.exports.default.worker;
    }finally{
      if(original===undefined)delete process.env.HUSTLE_AWS_PREVIEW_BUILD;
      else process.env.HUSTLE_AWS_PREVIEW_BUILD=original;
      if(originalCutover===undefined)delete process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD;
      else process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD=originalCutover;
    }
  };
  const normalWorker=runConfig(false),awsWorker=runConfig(true),cutoverWorker=runConfig(false,true);
  assert.throws(()=>runConfig(true,true),/mutually exclusive/);
  assert.equal(normalWorker.name,"hustle-ios-pwa-staging");
  assert.equal(normalWorker.env.HUSTLE_API_BACKEND_TARGET,"vercel-isolated-staging");
  assert.equal(normalWorker.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW,"false");
  assert.equal(awsWorker.name,"hustle-ios-pwa-aws-test");
  assert.equal(awsWorker.env.HUSTLE_API_BACKEND_TARGET,"aws-lambda-isolated-staging");
  assert.equal(awsWorker.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW,"true");
  assert.notEqual(awsWorker.name,normalWorker.name);
  assert.equal(cutoverWorker.name,"hustle-ios-pwa-staging","cutover must never deploy to test-worker name");
  assert.equal(cutoverWorker.env.HUSTLE_API_BACKEND_TARGET,"aws-lambda-isolated-staging");
  assert.equal(cutoverWorker.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW,"false","retain normal PWA identity");
  assert.deepEqual(cutoverWorker.assets.runWorkerFirst,normalWorker.assets.runWorkerFirst);
  // The AWS install manifest is a real Cloudflare static asset. Vinext's
  // /manifest.webmanifest route returned 404 after the first successful upload.
  const manifestPath="apps/web/public/aws-test.webmanifest";
  const staticManifest=JSON.parse(get(manifestPath));
  assert.equal(staticManifest.name,"Hustle AWS Test — The Economy of You");
  assert.equal(staticManifest.short_name,"Hustle AWS");
  assert.equal(staticManifest.id,"/aws-test");
  assert.equal(staticManifest.start_url,"/home");
  assert.equal(staticManifest.display,"standalone");
  assert.deepEqual(staticManifest.shortcuts.map(x=>x.url),["/search","/posts/new","/messages"]);
  assert.deepEqual(normalWorker.assets.runWorkerFirst,[
    "/*","!/_next/static/*","!/*/_next/static/*"
  ],"The existing Vercel staging Worker must keep its original asset routing");
  assert.deepEqual(awsWorker.assets.runWorkerFirst,[
    "/*","!/_next/static/*","!/*/_next/static/*","!/aws-test.webmanifest"
  ],"The AWS preview must bypass SSR only for its static manifest");

  const config=get("apps/web/cloudflare.config.ts");
  const layout=get("apps/web/app/layout.tsx");
  const manifest=get("apps/web/app/manifest.ts");
  const release=get(".github/workflows/hustle-cloudflare-aws-preview.yml");
  const standard=get(".github/workflows/hustle-cloudflare-staging-deploy.yml");
  const cutover=get(".github/workflows/hustle-cloudflare-staging-aws-cutover.yml");
  const cutoverYaml=YAML.parseDocument(cutover,{uniqueKeys:true});
  assert.equal(cutoverYaml.errors.length,0,"staging cutover workflow YAML must parse");
  assert.match(cutover,/workflow_dispatch:/);
  assert.doesNotMatch(cutover,/^\s{2}(?:push|pull_request):/m);
  assert.match(cutover,/I_AUTHORIZE_AWS_STAGING_CUTOVER_ONLY/);
  assert.match(cutover,/HUSTLE_STAGING_AWS_CUTOVER_BUILD: 'true'/);
  assert.match(cutover,/HUSTLE_API_BACKEND_TARGET: aws-lambda-isolated-staging/);
  assert.match(cutover,/environment: hustle-cloudflare-staging/);
  assert.match(cutover,/hustle-ios-pwa-staging.realxpens.workers.dev/);
  assert.doesNotMatch(standard,/HUSTLE_STAGING_AWS_CUTOVER_BUILD: 'true'/);
  const p=YAML.parseDocument(release,{uniqueKeys:true});
  assert.equal(p.errors.length,0,"manual parallel release YAML must parse");
  assert.match(config,/awsPreviewBuild \? "hustle-ios-pwa-aws-test" : "hustle-ios-pwa-staging"/);
  assert.match(config,/HUSTLE_API_BACKEND_TARGET: bindings\.text/);
  assert.match(config,/stagingAwsCutoverBuild/);
  assert.match(config,/awsPreviewBuild \? "aws-lambda-isolated-staging" : "vercel-isolated-staging"/);
  assert.match(config,/NEXT_PUBLIC_HUSTLE_AWS_PREVIEW: bindings\.text\(awsPreviewBuild \? "true" : "false"\)/);
  assert.match(layout,/HUSTLE · AWS TEST/);
  assert.match(layout,/<head>\{awsPreview && <link rel="manifest" href="\/aws-test\.webmanifest" \/>\}<\/head>/);
  assert.match(layout,/NEXT_PUBLIC_HUSTLE_AWS_PREVIEW.*?\/aws-test\.webmanifest/);
  assert.match(layout,/: "\/manifest\.webmanifest"/);

  assert.match(layout,/NEXT_PUBLIC_HUSTLE_AWS_PREVIEW === "true"/);
  assert.match(manifest,/awsPreview \? "\/aws-test" : "\/home"/);
  assert.match(manifest,/awsPreview \? "Hustle AWS" : "Hustle"/);
  assert.match(release,/workflow_dispatch:/);
  assert.doesNotMatch(release,/^\s{2}(?:push|pull_request):/m);
  assert.match(release,/github\.ref == 'refs\/heads\/main'/);
  assert.match(release,/environment: hustle-cloudflare-staging/);
  assert.match(release,/I_AUTHORIZE_PARALLEL_AWS_IPHONE_TEST_ONLY/);
  assert.match(release,/HUSTLE_AWS_PREVIEW_BUILD: 'true'/);
  assert.match(release,/HUSTLE_API_BACKEND_TARGET: aws-lambda-isolated-staging/);
  assert.match(release,/hustle-ios-pwa-aws-test\.realxpens\.workers\.dev/);
  assert.match(standard,/I_AUTHORIZE_ISOLATED_STAGING_ONLY/);
  assert.doesNotMatch(standard,/HUSTLE_AWS_PREVIEW_BUILD: 'true'/);
  console.log("PASS: AWS test Worker distinct from Vercel Worker, exact host routing, cookies, origin, sandbox guards, manifest and manually approved deploy");
}
main().catch(e=>{console.error(e);process.exitCode=1});
