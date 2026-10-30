#!/usr/bin/env node
// UX011 local, non-networked regression against the actual compiled Nest media
// service and pure policy helpers. No AWS access, database, production or media.
require("reflect-metadata");
const fs = require("node:fs");
const assert = require("node:assert/strict");

const { StagingUploadService } = require("../../apps/api/dist/post/staging-upload.service.js");
const { PostService } = require("../../apps/api/dist/post/post.service.js");
const { stagingRequestAllowed } = require("../../apps/api/dist/staging-request-policy.js");
const { signedUploadForm, temporaryObjectRead } = require("../../apps/api/dist/post/staging-s3.js");

const files = {
  template: fs.readFileSync("infra/aws/lambda/staging-template.yaml","utf8"),
  proxy: fs.readFileSync("apps/web/lib/api/isolated-web-proxy.ts","utf8"),
  editor: fs.readFileSync("apps/web/app/posts/post-editor.tsx","utf8"),
  uploadClient: fs.readFileSync("apps/web/lib/post-media-upload.ts", "utf8")
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
assert.match(files.editor, /function editorMediaPreviewSource\(/,
  "Both editor previews must share the same draft/private media policy");
assert.match(files.editor, /item\.storageKey\?\.startsWith\("media\/"\) && status !== "PUBLISHED"/,
  "Attached private draft media must not use anonymous public URLs");
assert.match(files.editor, /ownerMediaUrls\[item\.id\] \?\? null/,
  "Draft source must come exclusively from the authenticated blob preview");
assert.match(files.editor, /editorMediaPreviewSource\(item, post\.status, draftMediaPreviews\)/,
  "Attached-media thumbnails must obey private preview policy");
assert.match(files.editor, /editorMediaPreviewSource\(item, post\?\.status, draftMediaPreviews\)/,
  "Large content preview must obey the same private preview policy");
assert.doesNotMatch(files.editor, /src=\{post\.media\[0\]\.mediaUrl\}/,
  "Never read a DRAFT via published-only /media/p in the large preview");
assert.match(files.editor, /confirmStagingPostMedia/);
assert.match(files.editor, /pendingConfirmation/, "Failed verification retains signed receipt");
assert.match(files.editor, /Retry verification/, "Retry must be explicit to the author");
assert.match(files.editor, /pendingConfirmation\?\.file === selectedFile \? pendingConfirmation : null/, "Receipt retry path must not restart upload");
assert.match(files.editor, /video\/quicktime,\.mov/, "iPhone file picker allows QuickTime MOV");
assert.match(files.editor, /ref=\{fileInput\}/, "Keep selected native file control synchronized");
assert.doesNotMatch(files.editor, /event\.target\.value = ""/, "Do not erase native selection immediately");
assert.match(files.uploadClient, /function stagingUploadContentType\(/, "Normalize iOS MOV MIME");
assert.match(files.uploadClient, /stagingUploadContentType\(file\)/, "Use canonical MIME for signed upload metadata");
assert.match(files.uploadClient, /"video\/quicktime"/, "Recognize QuickTime upload");

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
      ? media.find(m=>m.id===where.id): null,
    upsert: async ({create}) => { writes++; media.push(create); return create; },
    delete: async ({where}) => {
      const removed = media.find(item => item.id === where.id);
      media = media.filter(item => item.id !== where.id);
      return removed;
    }
  },
  $transaction: async fn=>fn(prisma)
};
const auth={subject:"valid-client", emailVerified:true,phoneVerified:false};
const forged={subject:"other-client", emailVerified:true,phoneVerified:false};
const call=[];
let currentHeadStatus = 200;
let currentMime = "image/jpeg";
let currentSize = 1234;
let currentHeader = Buffer.from([0xff,0xd8,0xff,0xe0,0x12,0x34]);
global.fetch=async (url,init)=>{
  const action=init.method;
  call.push({url,action,headers:init.headers});
  assert.ok(String(url).startsWith("https://hustle-ux011-isolated-media-707859598737-eu-west-2.s3.eu-west-2.amazonaws.com/"));
  if(action==="HEAD")return new Response(null,{status:currentHeadStatus,headers:{"content-length":String(currentSize),"content-type":currentMime}});
  if(action==="GET")return new Response(currentHeader,{status:206});
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
  currentHeadStatus=404;
  await assert.rejects(service.confirm(auth,"client-post",{receipt:issued.receipt}),
    e=>e.getStatus?.()===404 && e.message==="Pending private media bytes not received",
    "Only a signed owner's actual S3 HEAD 404 can confirm an absent pending upload");
  assert.equal(writes,0,"Missing pending bytes must have no DB side effects");
  currentHeadStatus=503;
  await assert.rejects(service.confirm(auth,"client-post",{receipt:issued.receipt}),
    e=>e.getStatus?.()===502,
    "S3 upstream errors must stay inconclusive, never authorize retransmission");
  assert.equal(writes,0);
  currentHeadStatus=200;
  call.length=0;
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

  // A new disposable QuickTime-only draft: iOS MOV metadata is accepted, but
  // server independently refuses an MP4 file merely renamed .mov.
  status="DRAFT";
  media=[];
  currentMime="video/quicktime";
  currentSize=2650;
  currentHeader=Buffer.alloc(32);
  currentHeader.write("ftyp",4,"ascii");
  currentHeader.write("isom",8,"ascii");
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"video/avi",size:2650}),
    e=>e.getStatus?.()===400);
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"video/quicktime",size:30_000_001}),
    e=>e.getStatus?.()===400);
  const mov=await service.authorize(auth,"client-post",{contentType:"video/quicktime",size:2650});
  assert.equal(mov.contentType,"video/quicktime");
  assert.equal(mov.maxBytes,30_000_000);
  assert.equal(mov.fields["Content-Type"],"video/quicktime");
  await assert.rejects(service.confirm(auth,"client-post",{receipt:mov.receipt}),
    e=>e.getStatus?.()===400, "Reject renamed MP4 via ftyp major-brand mismatch");
  assert.equal(media.length,0,"Spoofed MOV must not be attached");
  currentHeader.write("qt  ",8,"ascii");
  const movResult=await service.confirm(auth,"client-post",{receipt:mov.receipt});
  assert.equal(movResult.alreadyAttached,false);
  assert.equal(media.length,1);
  assert.equal(media[0].type,"VIDEO");
  assert.equal(media[0].position,0);
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"image/jpeg",size:1234}),
    e=>e.getStatus?.()===409, "One-video draft must refuse carousel images");
  await assert.rejects(service.publicMedia("client-post",movResult.mediaId),
    e=>e.getStatus?.()===404, "Unpublished MOV must remain private");
  assert.equal((await service.confirm(auth,"client-post",{receipt:mov.receipt})).alreadyAttached,true,
    "QuickTime retry may not insert twice");

  // A DB failure after S3 CopyObject must leave the temporary source intact.
  // A valid retry may re-copy the object and attach it once.
  media=[];
  currentMime="image/jpeg";
  currentSize=1234;
  currentHeader=Buffer.from([0xff,0xd8,0xff,0xe0,0x12,0x34]);
  const recover=await service.authorize(auth,"client-post",{contentType:"image/jpeg",size:1234});
  const originalTransaction=prisma.$transaction;
  let rejectOnce=true;
  prisma.$transaction=async fn=>{
    if (rejectOnce) { rejectOnce=false; throw new Error("Simulated database commit failure"); }
    return originalTransaction(fn);
  };
  const beforeError=call.length;
  await assert.rejects(service.confirm(auth,"client-post",{receipt:recover.receipt}), /Simulated database/);
  assert.deepEqual(call.slice(beforeError).map(x=>x.action),["HEAD","GET","PUT"],
    "When DB fails, copy leaves pending source for retry");
  assert.equal(media.length,0);
  const recovered=await service.confirm(auth,"client-post",{receipt:recover.receipt});
  assert.equal(recovered.alreadyAttached,false);
  assert.equal(recovered.cleanupDeferred,false);
  assert.equal(media.length,1);
  assert.deepEqual(call.slice(beforeError+3).map(x=>x.action),["HEAD","GET","PUT","DELETE"]);
  assert.equal((await service.confirm(auth,"client-post",{receipt:recover.receipt})).alreadyAttached,true,
    "Receipt recovery must not duplicate PostMedia");

  // An owner deliberately removing attached media also removes only THEIR
  // exact private S3 object, AFTER the DB reference is deleted.
  status="PUBLISHED";
  const postService=new PostService(prisma);
  postService.requireContentProfile=async ()=>({id:"owner-profile",userId:"client-user"});
  postService.requireOwnedPost=async ()=>({id:"client-post",status,media});
  const target=media[0];
  const beforeDelete=call.length;
  await postService.removeMedia(auth,"client-post",target.id);
  assert.equal(media.length,0,"Owner removal deletes the PostMedia record");
  assert.deepEqual(call.slice(beforeDelete).map(x=>x.action),["DELETE"]);
  assert.ok(call.at(-1).url.endsWith(target.storageKey),"Only exact owner key is deleted");

  // A media row with an unexpected key never becomes an arbitrary S3 delete.
  media=[{id:"legacy-row",postId:"client-post",storageKey:"media/someone-else/another-post/id",type:"IMAGE"}];
  const beforeUnsafe=call.length;
  await postService.removeMedia(auth,"client-post","legacy-row");
  assert.equal(call.length,beforeUnsafe,"Never delete a non-matching object key");

  process.env.HUSTLE_RUNTIME_SCOPE="production";
  await assert.rejects(service.authorize(auth,"client-post",{contentType:"image/jpeg",size:100}),e=>e.getStatus?.()===503);
  console.log("PASS: UX011 isolated owner uploads, scoped signed POST, S3 byte verification, idempotent media promotion, no draft disclosure, public gating and zero real network calls");
})().catch(e=>{console.error(e);process.exitCode=1});
