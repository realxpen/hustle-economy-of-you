# UX011 — Private iPhone photo/video upload: staging release gate

Status: **CODE IMPLEMENTATION IN REVIEW — NOT DEPLOYED**. Related issue #244.

## Functional path

Existing signed-in Client or Hustler → Post editor → select iPhone JPEG/PNG/WebP (up to 8MB) or MP4 (up to 30MB) → local preview → save/create a DRAFT → authenticated signed-upload authorization → browser uploads bytes **directly to isolated S3** → server confirms owner, size, content type and file magic bytes → server copies object out of one-day temporary prefix → idempotent PostMedia record → owner can preview draft through an authenticated read → deliberate Publish makes a stable same-origin media URL available from public Post/Feed. Post service offer attachments and original seller attribution stay intact.

No auto-posting, real payment, media-to-escrow connection or broad anonymous staging POST route. External public HTTPS media URLs are retained while camera roll uploads are validated.

## Explicit storage/infrastructure boundaries

- S3 bucket name: `hustle-ux011-isolated-media-707859598737-eu-west-2`.
- CloudFormation creates **private** S3 bucket with blocked public ACL/bucket policies, bucket owner enforcement, AES256 at rest, HTTPS-only deny policy, CORS allow only `https://hustle-ios-pwa-staging.realxpens.workers.dev`, and 1-day lifecycle expiry for unfinished `pending/` objects.
- The existing staging Lambda IAM execution role gains **GetObject, PutObject, DeleteObject ONLY for media/pending object prefixes** of this bucket. No production bucket permissions and no new unbounded route. S3 read access only via short-lived signed 307 redirects validated at the exact Cloudflare proxy host.
- The Lambda has AWS provided temporary execution credentials. Presigned 5-minute S3 POST policy authorizes exactly one unpredictable key, content type and constrained file size. The client never receives AWS secret access keys, arbitrary S3 credentials or tokens usable to sign other URLs.
- API receipts are HMAC-protected under isolated BETTER_AUTH_SECRET, signed to author ID, post ID, MIME, object size, UUID, and 10-minute expiration. Confirm checks same signed-in owner and DRAFT; authorized upload bytes are checked with S3 HEAD and range-read file signature. Only then PostMedia points to the promoted private object.
- Owner preview uses short-lived token-authenticated bytes through existing same-origin API. Unpublished/archived media is not readable from the anonymous media route.
- The bucket has DeletionPolicy Retain, so deleting CloudFormation does not silently delete user media; its storage costs must be cleaned up explicitly after the invited staging pilot.

## Validation and caveats

- Never run production deployments, paid providers, real-media uploads or upload a sensitive photo/video in acceptance testing.
- First verify Foundation CI, Web+API build/typecheck, isolated Cloudflare boundary and compiled no-network UX011 regression.
- **IAM bootstrap BLOCKER (verified read-only):** the existing `hustle-github-isolated-staging-deployer` role's current inline policy `HustleOnlyReviewedStagingStack` has no S3 CreateBucket/PutBucket permissions. The new CloudFormation bucket **will fail** if a normal Lambda deployment is attempted as-is. The minimal, *additive* S3 bucket-scoped statement is in `infra/aws/lambda/ux011-staging-deployer-additive-policy.json`. An authorized administrator must approve/apply the addition to the **existing** inline policy (preserve all other statements). This PR does not grant itself AWS IAM privileges.
- **Manual protected Lambda workflow FIRST (ONLY AFTER IAM BOOTSTRAP):** on `main`, select `I_AUTHORIZE_AWS_ISOLATED_STAGING_ONLY`. This creates a new chargeable but private and prefixed S3 bucket, IAM execution policy and API container only in the isolated eu-west-2 staging account. Founder must explicitly approve.
- **Manual protected Cloudflare Worker workflow SECOND:** on `main`, select `I_AUTHORIZE_AWS_STAGING_CUTOVER_ONLY`. Verify regular PWA's same-origin auth and 200/401 safety smoke.
- Sign in as disposable Client, use a **non-sensitive JPG** from iPhone, verify file-picker preview, HTTP upload progress and Post DRAFT (do not publish initially). Reload draft and verify private media preview. Confirm another account cannot access draft media.
- Publish only non-sensitive disposable media intentionally, open Post as another invited user, verify media playback and original seller offer reference, then archive post and confirm public media URL refuses access.
- Repeat with 1 MP4 video and multiple images to check carousel limits, failed network/retry and cancelling mid-transfer.
- Read-only audit: exact new PostMedia and Post owner; no other account's data leaked and no financial/ledger changes.

## Limitations — not production-ready

- HEIC and MOV are rejected with a clear explanation; iPhone may need JPEG/MP4 export. Universal iPhone format conversion/transcoding is a separate follow-up.
- Only file header signatures and limited content-type checks are implemented, not full antivirus/ML content moderation, image decompression bombs, video codec compatibility or public-scale user abuse prevention. These must be addressed before broad user launch.
- One-day `pending/` expiry cleans incomplete transfers. A promoted object without a committed DB record, and a deleted media row whose object remains, can leave unreferenced objects requiring a monitored lifecycle cleanup job; not yet implemented.
- S3 is pay-per-use and no hard automatic monetary cap is included. CloudFormation deployment requires cost/retention review and manual approval.
- The staging Post editor and media URL remain normal iPhone PWA; this work does not ship a native React Native app build.
