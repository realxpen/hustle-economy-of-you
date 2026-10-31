import assert from "node:assert/strict";
import { validatedPreviewUpstream, allowedPreviewApiPath } from "../../infra/cloudflare/payment-preview-api-worker.mjs";
import edge from "../../infra/cloudflare/payment-preview-api-worker.mjs";

const good="https://abc123def456.lambda-url.eu-west-2.on.aws";
assert.equal(validatedPreviewUpstream(good),good);
for(const bad of [
  "https://hh2zi77ntrsjj3rgapko7rsjv40ztgpu.lambda-url.eu-west-2.on.aws",
  "http://abc123def456.lambda-url.eu-west-2.on.aws",
  "https://example.com",
  "https://abc123def456.lambda-url.eu-west-2.on.aws/anything",
  "https://abc123def456.lambda-url.eu-west-2.on.aws?x=1",
  "https://user@abc123def456.lambda-url.eu-west-2.on.aws",
  "https://abc123def456.lambda-url.us-east-1.on.aws",undefined,""
]) assert.throws(()=>validatedPreviewUpstream(bad),/^Error: REFUSED:/);
for(const [verb,path] of [
  ["GET","/api/v1/health"],["GET","/api/v1/payments/pay1234"],
  ["POST","/api/v1/payments/webhooks/paystack"],["POST","/api/auth/sign-in/email"],
  ["POST","/api/v1/payments/initialize"]])
  assert.equal(allowedPreviewApiPath(path,verb),true);
for(const [verb,path] of [
  ["GET","/api/v1/payments/webhooks/paystack"],
  ["POST","/admin"],["POST","/api/v1/payments/%2e%2e/admin"],
  ["POST","/api/v1/payments/../admin"],["POST","//api/v1/payments/initialize"],
  ["GET","/api/v1/health\\evil"],["TRACE","/api/v1/health"]])
  assert.equal(allowedPreviewApiPath(path,verb),false);

const API="https://hustle-payment-preview-api.realxpens.workers.dev";
const WEB="https://hustle-payment-preview.realxpens.workers.dev";
const env={PREVIEW_UPSTREAM_ORIGIN:good};
const originalFetch=globalThis.fetch;
let called=[];
globalThis.fetch=async(url,opts)=>{
  called.push({url:String(url),opts});
  return new Response(JSON.stringify({ok:true}),{status:200,headers:{"content-type":"application/json","server":"not-for-client"}});
};
try {
  let x=await edge.fetch(new Request(API+"/api/v1/health"),env);
  assert.equal(x.status,200);
  assert.equal(x.headers.get("server"),null);
  assert.equal(called.length,1);
  assert.equal(called[0].url,good+"/api/v1/health");
  assert.equal(called[0].opts.headers.get("x-hustle-preview-edge"),"payment-preview-test-only");
  const raw='{"event":"charge.success","data":{"reference":"hustle-test","amount":100}}';
  x=await edge.fetch(new Request(API+"/api/v1/payments/webhooks/paystack",{
    method:"POST",body:raw,headers:{"x-paystack-signature":"signed","content-type":"application/json"}
  }),env);
  assert.equal(x.status,200);
  assert.equal(called.length,2);
  assert.equal(await new Response(called[1].opts.body).text(),raw,"raw HMAC bytes must not be reserialized");
  assert.equal(called[1].opts.headers.get("x-paystack-signature"),"signed");
  x=await edge.fetch(new Request(API+"/api/v1/health",{headers:{"origin":WEB}}),env);
  assert.equal(x.headers.get("access-control-allow-origin"),WEB);
  assert.equal(x.headers.get("access-control-allow-credentials"),"true");
  const before=called.length;
  for (const req of [
    new Request("https://hustle-ios-pwa-staging.realxpens.workers.dev/api/v1/health"),
    new Request(API+"/admin"),new Request(API+"/api/v1/payments/%2fadmin")
  ]) {
    assert.equal((await edge.fetch(req,env)).status,404);
  }
  assert.equal(called.length,before,"unsafe requests cannot fetch Lambda");
  assert.equal((await edge.fetch(new Request(API+"/api/v1/health"),{
    PREVIEW_UPSTREAM_ORIGIN:"https://hh2zi77ntrsjj3rgapko7rsjv40ztgpu.lambda-url.eu-west-2.on.aws"
  })).status,503);
  assert.equal(called.length,before,"existing staging Lambda never eligible");
} finally { globalThis.fetch=originalFetch; }
console.log("PASS: separate API Worker rejects staging/production origins, unsafe routes and arbitrary hosts; signed Paystack webhook bytes remain unchanged (offline).");
