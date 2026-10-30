#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
require("reflect-metadata");
const fs=require("node:fs");
const path=require("node:path");
const Module=require("node:module");
const ts=require("typescript");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const source=p=>fs.readFileSync(path.join(root,p),"utf8");
function load(p) {
 const filename=path.join(root,p);
 const mod=new Module(filename,module);
 mod.filename=filename;
 mod.paths=Module._nodeModulePaths(path.dirname(filename));
 mod._compile(ts.transpileModule(source(p),{compilerOptions:{
  module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
  experimentalDecorators:true,emitDecoratorMetadata:false
 }}).outputText,filename);
 return mod.exports;
}
(async()=>{
 const Gateway=load("apps/api/src/payment/paystack-test.gateway.ts").PaystackTestGateway;
 const gateway=new Gateway();
 const originalFetch=global.fetch;
 const originalKey=process.env.PAYSTACK_TEST_SECRET_KEY;
 const originalOrigin=process.env.PAYSTACK_TEST_RETURN_ORIGIN;
 const calls=[];
 const apiReference="hustle-test-attempt-35";
 let tamperAmount=false;
 global.fetch=async (url,init)=>{
   calls.push({url,init});
   assert.match(init.headers.authorization,/^Bearer sk_test_/);
   if(url.endsWith("/transaction/initialize")) {
     const body=JSON.parse(init.body);
     assert.equal(body.reference,apiReference);
     assert.equal(body.amount,2500000);
     assert.equal(body.currency,"NGN");
     assert.equal(body.email,"customer@example.com");
     assert.match(body.callback_url,/^https:\/\/hustle\.example\/orders\/order-35\?payment_return=1$/);
     return new Response(JSON.stringify({status:true,data:{
       authorization_url:"https://checkout.paystack.com/legitimate",
       access_code:"legitimate",reference:body.reference
     }}),{status:200,headers:{"content-type":"application/json"}});
   }
   if(url.endsWith("/transaction/verify/"+apiReference)) {
     return new Response(JSON.stringify({status:true,data:{
       domain:"test",status:"success",reference:apiReference,
       id:24593178,amount:tamperAmount?2500001:2500000,currency:"NGN"
     }}),{status:200,headers:{"content-type":"application/json"}});
   }
   throw Error("Unexpected Paystack call "+url);
 };
 try {
   process.env.PAYSTACK_TEST_SECRET_KEY="sk_test_UNITTESTONLY";
   process.env.PAYSTACK_TEST_RETURN_ORIGIN="https://hustle.example";
   const attempt=await gateway.initializePayment({
     attemptId:"test-attempt-35",subjectType:"ORDER",subjectId:"order-35",
     currency:"NGN",amountMinor:2500000,payerEmail:"customer@example.com"
   });
   assert.equal(attempt.provider,"PAYSTACK_TEST");
   assert.equal(attempt.providerReference,apiReference);
   assert.equal(attempt.checkoutUrl,"https://checkout.paystack.com/legitimate");
   const webhook={event:"charge.success",data:{
     id:24593178,domain:"test",status:"success",reference:apiReference,
     amount:2500000,currency:"NGN"
   }};
   const raw=Buffer.from(JSON.stringify(webhook));
   const signature=crypto.createHmac("sha512",process.env.PAYSTACK_TEST_SECRET_KEY).update(raw).digest("hex");
   const verified=await gateway.verifyWebhook(webhook,signature,raw);
   assert.equal(verified.provider,"PAYSTACK_TEST");
   assert.equal(verified.type,"payment.succeeded");
   assert.equal(verified.amountMinor,2500000);
   assert.equal(verified.eventId,"charge.success:24593178");
   const unsigned=await gateway.verifyWebhook(webhook,"0000",raw).catch(e=>e);
   assert.match(String(unsigned.message),/signed webhook evidence|signature/i);
   const malformed=Buffer.from(JSON.stringify({...webhook,event:"charge.failed"}));
   const malformedSignature=crypto.createHmac("sha512",process.env.PAYSTACK_TEST_SECRET_KEY).update(malformed).digest("hex");
   assert.equal(await gateway.verifyWebhook(JSON.parse(malformed.toString()),malformedSignature,malformed),null);
   tamperAmount=true;
   await assert.rejects(
     ()=>gateway.verifyWebhook(webhook,signature,raw),
     /does not match/i
   );
   tamperAmount=false;
   process.env.PAYSTACK_TEST_SECRET_KEY="sk_live_CANNOTBEUSED";
   await assert.rejects(()=>gateway.initializePayment({
      attemptId:"x",subjectType:"ORDER",subjectId:"order-35",
      amountMinor:2500000,currency:"NGN",payerEmail:"customer@example.com"
   }),/test secret is not configured/i);
   assert.equal(calls.filter(x=>x.url.endsWith("/transaction/initialize")).length,1);
   assert.equal(calls.filter(x=>x.url.includes("/transaction/verify/")).length,2);
   const mod=source("apps/api/src/payment/payment.module.ts");
   const ctrl=source("apps/api/src/payment/payment.controller.ts");
   const service=source("apps/api/src/payment/payment.service.ts");
   assert.match(mod,/HUSTLE_PAYMENT_GATEWAY/);
   assert.match(mod,/selected === "paystack-test"/);
   assert.match(ctrl,/@Post\("paystack"\)/);
   assert.match(ctrl,/request\.rawBody/);
   assert.match(service,/payerEmail: user\.emailVerified/);
   assert.match(service,/await this\.gateway\.verifyWebhook\(payload, signature, rawBody\)/);
   assert.match(service,/assertWebhookMatchesAttempt\(webhook, attempt\)/);
   assert.match(service,/domainAppliedAt/);
   assert.doesNotMatch(source("apps/web/components/finance/transaction-finance-actions.tsx"),/PAYSTACK_TEST_SECRET_KEY/);
   console.log("PASS Paystack: real API shape, test-only secret, verified signed webhook, anti-tamper, no duplicate payment framework.");
 }finally{
   global.fetch=originalFetch;
   if(originalKey===undefined)delete process.env.PAYSTACK_TEST_SECRET_KEY;
   else process.env.PAYSTACK_TEST_SECRET_KEY=originalKey;
   if(originalOrigin===undefined)delete process.env.PAYSTACK_TEST_RETURN_ORIGIN;
   else process.env.PAYSTACK_TEST_RETURN_ORIGIN=originalOrigin;
 }
})().catch(e=>{console.error(e);process.exitCode=1});
