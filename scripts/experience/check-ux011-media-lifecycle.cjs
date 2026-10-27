#!/usr/bin/env node
// UX011 local, non-networked regression against the actual compiled Nest media
// service and pure policy helpers. No AWS access, database, production or media.
require("reflect-metadata");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { StagingUploadService } = require("../../apps/api/dist/post/staging-upload.service.js");
const { stagingRequestAllowed } = require("../../apps/api/dist/staging-request-policy.js");
const { signedUploadForm, temporaryObjectRead } = require("../../apps/api/dist/post/staging-s3.js");

const files = {
  template: fs.readFileSync("infra/aws/lambda/staging-template.yaml","utf8"),
  proxy: fs.readFileSync("apps/web/lib/api/isolated-web-proxy.ts","utf8"),
  editor: fs.readFileSync("apps/web/app/posts/post-editor.tsx","utf8")
};
for (const marker of [
  "hustle-ux011-isolated-media-707859598737-eu-west-2",
  "BlockPublicAcls: true", "BlockPublicPolicy: true",
  "BucketOwnerEnforced", "RemoveUncommittedUploads",
  "HUSTLE_STAGING_MEDIA_BUCKET: !Ref MediaBucket",
  "s3:PutObject, s3:GetObject, s3:DeleteObject"
]) assert.ok(files.template.includes(marker), "missing storage infrastructure contract: " + marker);
assert.match(files.proxy, /Unsafe media redirect blocked/);
assert.match(files.proxy, /isolatedMediaRead\.test/);
assert.match(files.proxy, /postMediaUploadAction\.test/);
assert.match(files.editor, /type="file"/);
assert.match(files.editor, /selectedPreview/);
assert.match(files.editor, /uploadProgress/);
assert.match(files.editor, /uploadAbort\.current\?\.abort\(\)/);
assert.match(files.editor, /confirmStagingPostMedia/);

for (const path of [
  "/api/v1/posts/owned-post/media/uploads/authorize",
  "/api/v1/posts/owned-post/media/uploads/confirm"
]) assert.equal(stagingRequestAllowed("POST",path), true, "explicit staging owner upload action");
for (const path of ["/api/v1/media/p/owned-post/abc","/api/v1/media/o/owned-post/abc"])
  assert.equal(stagingRequestAllowed("GET",path), true);
for (const path of ["/api/v1/upload","/api/v1/payments/initialize"])
  assert.equal(stagingRequestAllowed("POST",path), false, "no broad write allowlist");

Object.assign(process.env,{
  HUSTLE_RUNTIME_SCOPE: "isolated-staging",
  HUSTLE_AWS_ACCOUNT_ID: "707859598737",
  HUSTLE_STAGING_MEDIA_BUCKET: "hustle-ux011-isolated-media-707859598737-eu-west-2",
  HUSTLE_FINANCIAL_PROVIDERS_ENABLED: "false",
  AWS_ACCESS_KEY_ID: "AKIATESTSTAGINGONLY",
  AWS_SECRET_ACCESS_KEY: "not-a-real-aws-credential-test-only",
  AWS_SESSION_TOKEN: "fake-test-token",
  BETTER_AUTH_SECRET: "disposable-fake-local-signature-test-secret"
});
const form = signedUploadForm("pending/client-user/client-post/aabb", "image/jpeg", 8_000_000);
assert.equal(form.uploadUrl,"https://hustle-ux011-isolated-media-707859598737-eu-west-2.s3.eu-west-2.amazonaws.com/");
assert.equal(form.fields["Content-Type"],"image/jpeg");
assert.equal(form.fields.success_action_status,"204");
const policy = JSON.parse(Buffer.from(form.fields.Policy,"base64").toString());
assert.ok(policy.conditions.some(v=>Array.isArray(v) && v[0]==="content-length-range"));
assert.ok(policy.conditions.some(v=>v.key==="pending/client-user/client-post/aabb"));
const read = temporaryObjectRead("media/client-user/client-post/test",60);
assert.match(read,/X-Amz-Signature=[0-9a-f]{64}/);
assert.ok(!read.includes("not-a-real-aws-credential"),"No AWS secret in browser URLs");

let status="DRAFT";
let author="client-user";
let media=[];
let writes=0;
const prisma={
  user: { findUnique: async ({where}) => where.authSubject==="valid-client"
    ? {id:author} : where.authSubject==="other-client" ? {id:"other"} : null },
  post: { findFirst: async ({where}) => where.id==="client-post" && where.professionalProfile?.userId===author
    ? {id:"client-post",status,media} : null },
  postMedia:{
    findUnique: async ({where}) => media.find(m=>m.id===where.id)||null,
    findFirst: async ({where}) => status==="PUBLISHED" &&
      where.postId==="client-post" && media.some(m=>m.id===where.id)
      ? {storageKey:media.find(m=>m.id===where.id).storageKey}: null,
    upsert: async ({create}) => { writes++; media.push(create); return create; }
  },
  $transaction: async fn=>fn(prisma)
};
const auth={subject:"valid-client", emailVerified:true,phoneVerified:false};
const forged={subject:"other-client", emailVerified:true,phoneVerified:false};
const call=[];
global.fetch=async (url,init)=>{
  const action=init.method;
  call.push({url,action,headers:init.headers});
  assert.ok(String(url).startsWith("https://hustle-ux011-isolated-media-707859598737-eu-west-2.s3.eu-west-2.amazonaws.com/"));
  if(action==="HEAD")return new Response(null,{status:200,headers:{"content-length":"1234","content-type":"image/jpeg"}});
  if(action==="GET")return new Response(Buffer.from([0xff,0xd8,0xff,0xe0,0x12,0x34]),{status:206});
  if(action==="PUT")return new Response("<CopyObjectResult><ETag>mock</ETag></CopyObjectResult>",{status:200});
  if(action==="DELETE")return new Response(null,{status:204});
  throw Error("Unexpected S3 method: "+action);
};
(async()=>{
  const service=new StagingUploadService(prisma);
  await assert.rejects(service.authorize(forged,"client-post",{contentType:"image/jpeg",size:1234}),e=>e.getStatus?.()===404);
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"image/svg+xml",size:1234}),e=>e.getStatus?.()===400);
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"image/jpeg",size:9_000_000}),e=>e.getStatus?.()===400);
  assert.equal(call.length,0,"Unsafe identities and files must not reach S3");

  const issued=await service.authorize(auth,"client-post",{contentType:"image/jpeg",size:1234});
  assert.equal(issued.size,1234);
  await assert.rejects(service.confirm(forged,"client-post",{receipt:issued.receipt}),e=>e.getStatus?.()===404);
  await assert.rejects(service.confirm(auth,"client-post",{receipt:issued.receipt.slice(0,-2)+"aa"}),e=>e.getStatus?.()===403);
  assert.equal(call.length,0,"Receipt and identity checked before any S3 object lookup");
  const result=await service.confirm(auth,"client-post",{receipt:issued.receipt});
  assert.equal(result.alreadyAttached,false);
  assert.equal(writes,1);
  assert.equal(media.length,1);
  assert.match(media[0].storageKey,/^media\/client-user\/client-post\/[a-f0-9-]{36}$/);
  assert.match(media[0].mediaUrl,/^https:\/\/hustle-ios-pwa-staging\.realxpens\.workers\.dev\/api\/isolated\/api\/v1\/media\/p\//);
  assert.deepEqual(call.map(a=>a.action),["HEAD","GET","PUT","DELETE"]);
  assert.ok(!call.some(a=>/hustle-isolated-staging-api/.test(a.url)),"Never proxy object bytes to Lambda");

  const repeat=await service.confirm(auth,"client-post",{receipt:issued.receipt});
  assert.equal(repeat.alreadyAttached,true);
  assert.equal(writes,1);
  await assert.rejects(service.publicMedia("client-post",result.mediaId),e=>e.getStatus?.()===404);
  status="PUBLISHED";
  assert.match(await service.publicMedia("client-post",result.mediaId),/X-Amz-Expires=60/);

  process.env.HUSTLE_RUNTIME_SCOPE="production";
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"image/jpeg",size:100}),e=>e.getStatus?.()===503);
  console.log("PASS: UX011 isolated owner uploads, scoped signed POST, S3 byte verification, idempotent media promotion, no draft disclosure, public gating and zero real network calls");
})().catch(e=>{console.error(e);process.exitCode=1});
