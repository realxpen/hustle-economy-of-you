#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const YAML = require("yaml");
const root = path.resolve(__dirname, "../..");
const get = p => fs.readFileSync(path.join(root,p),"utf8");
const configPath = path.join(root,"apps/web/cloudflare.config.ts");
const source = get("apps/web/cloudflare.config.ts");
const previous = {
  preview:process.env.HUSTLE_AWS_PREVIEW_BUILD,
  cutover:process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD
};
function workerConfig(preview,cutover) {
  if(preview)process.env.HUSTLE_AWS_PREVIEW_BUILD="true";
  else delete process.env.HUSTLE_AWS_PREVIEW_BUILD;
  if(cutover)process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD="true";
  else delete process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD;
  const m=new Module(configPath,module);
  m.filename=configPath;
  m.paths=Module._nodeModulePaths(path.dirname(configPath));
  m.require=name=>{
    assert.equal(name,"cf/config");
    return {
      bindings:{assets:()=>({type:"assets"}),images:()=>({type:"images"}),text:v=>v},
      defineConfig:v=>v,defineWorker:v=>v
    };
  };
  m._compile(ts.transpileModule(source,{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText,configPath);
  return m.exports.default.worker;
}
try {
  const vercel=workerConfig(false,false);
  const awsTest=workerConfig(true,false);
  const awsStaging=workerConfig(false,true);
  assert.throws(()=>workerConfig(true,true),/mutually exclusive/);
  assert.equal(vercel.name,"hustle-ios-pwa-staging");
  assert.equal(vercel.env.HUSTLE_API_BACKEND_TARGET,"vercel-isolated-staging");
  assert.equal(vercel.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW,"false");
  assert.equal(awsTest.name,"hustle-ios-pwa-aws-test");
  assert.equal(awsTest.env.HUSTLE_API_BACKEND_TARGET,"aws-lambda-isolated-staging");
  assert.equal(awsTest.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW,"true");
  assert.equal(awsStaging.name,"hustle-ios-pwa-staging");
  assert.equal(awsStaging.env.HUSTLE_API_BACKEND_TARGET,"aws-lambda-isolated-staging");
  assert.equal(awsStaging.env.NEXT_PUBLIC_HUSTLE_AWS_PREVIEW,"false");
  assert.deepEqual(vercel.assets.runWorkerFirst,awsStaging.assets.runWorkerFirst);
  assert.notDeepEqual(awsTest.assets.runWorkerFirst,awsStaging.assets.runWorkerFirst);
  const cutover = get(".github/workflows/hustle-cloudflare-staging-aws-cutover.yml");
  const oldDeploy = get(".github/workflows/hustle-cloudflare-staging-deploy.yml");
  const awsPreviewWorkflow = get(".github/workflows/hustle-cloudflare-aws-preview.yml");
  assert.equal(YAML.parseDocument(cutover,{uniqueKeys:true}).errors.length,0);
  assert.match(cutover,/workflow_dispatch:/);
  assert.doesNotMatch(cutover,/^\s{2}(push|pull_request):/m);
  assert.match(cutover,/I_AUTHORIZE_AWS_STAGING_CUTOVER_ONLY/);
  assert.match(cutover,/environment: hustle-cloudflare-staging/);
  assert.match(cutover,/github.ref == 'refs\/heads\/main'/);
  assert.match(cutover,/github.repository == 'realxpen\/hustle-economy-of-you'/);
  assert.match(cutover,/HUSTLE_AWS_PREVIEW_BUILD: 'false'/);
  assert.match(cutover,/HUSTLE_STAGING_AWS_CUTOVER_BUILD: 'true'/);
  assert.match(cutover,/HUSTLE_API_BACKEND_TARGET: aws-lambda-isolated-staging/);
  assert.match(cutover,/NEXT_PUBLIC_HUSTLE_AWS_PREVIEW: 'false'/);
  assert.match(cutover,/HUSTLE_ISOLATED_PWA_GATE: isolated-staging/);
  assert.match(cutover,/payments\/initialize/);
  assert.match(cutover,/test "\$PAYMENT_DENIED" = "403"/);
  assert.match(cutover,/concurrency:[\s\S]*?group: hustle-cloudflare-isolated-staging/);
  assert.match(cutover,/hustle-ios-pwa-staging\.realxpens\.workers\.dev/);
  assert.doesNotMatch(oldDeploy,/HUSTLE_STAGING_AWS_CUTOVER_BUILD: 'true'/);
  assert.match(oldDeploy,/I_AUTHORIZE_ISOLATED_STAGING_ONLY/);
  assert.match(awsPreviewWorkflow,/hustle-ios-pwa-aws-test\.realxpens\.workers\.dev/);
  console.log("PASS: three exact Cloudflare deployment identities, explicit protected cutover gate, Vercel rollback and independent AWS test Worker");
} finally {
  if(previous.preview===undefined)delete process.env.HUSTLE_AWS_PREVIEW_BUILD;
  else process.env.HUSTLE_AWS_PREVIEW_BUILD=previous.preview;
  if(previous.cutover===undefined)delete process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD;
  else process.env.HUSTLE_STAGING_AWS_CUTOVER_BUILD=previous.cutover;
}
