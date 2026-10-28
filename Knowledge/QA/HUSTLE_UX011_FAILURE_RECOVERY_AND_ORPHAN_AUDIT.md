# UX011 final safety gate — upload retry, owner deletion and storage reconciliation

Status: PR CODE ONLY. Not deployed to AWS or Cloudflare.

## Existing accepted iPhone staging evidence
Client @xpen has successfully uploaded private JPEG/PNG, an ordered 2-image draft,
MP4 and QuickTime MOV drafts, played both video formats on iPhone, tested
wrong-account and public DRAFT isolation, intentionally published an image,
archived that public test post, and cancelled a private upload with no attached
media or pending object. These passes were recorded in UX011 #244.

## What this safety patch changes
1. **Keep pending bytes until database commit.** Previously S3 CopyObject
   deleted the pending source before the serializable Prisma transaction. If
   that transaction failed, there was no retriable pending source. Now a
   completed copy leaves pending content until PostMedia commits; only then
   does the backend DELETE pending. A failed cleanup does NOT roll back an
   already committed attachment, and S3's existing one-day pending lifecycle
   is the fallback. A retry of the same unexpired signed receipt uses the
   same media UUID and cannot create a duplicate row.
2. **Retry verification, not transfer.** The iPhone editor retains the
   signed receipt after a completed S3 transfer. If the verification/API
   response fails, tapping **Retry verification** reuses that receipt and
   never uploads a second object. A new selected file clears the receipt.
   The Verify phase is not labelled cancellable since the DB write may
   already be committed. The user must still explicitly Publish.
3. **Delete only the owner's exact private object when removing media.**
   Following an authorized PostMedia database removal, the API attempts
   S3 DELETE only for the exact
   `media/<resolved-owner-id>/<post-id>/<media-uuid>` key. Legacy external
   URLs, unexpected keys and other users' objects are never sent to S3.
   S3 deletion failure is logged for operator reconciliation; it cannot
   make the media publicly available because the PostMedia row is gone.
4. **Read-only orphan reconciliation.** Operators can compare a COMPLETE
   isolated staging S3 object inventory against authoritative Neon
   PostMedia.storageKey values with
   `scripts/experience/ux011-media-orphan-audit.cjs`. It refuses a partial
   or non-staging bucket, distinguishes pending/ lifecycle objects from
   current references, and flags ONLY unreferenced valid media/ keys older
   than 48 hours for manual review. It NEVER issues AWS or Neon requests and
   NEVER deletes objects. Running it without both inventories is not an
   automated orphan cleanup job.

## Current limitations and safety boundary
- No automatic permanent orphan purge: a successful S3 copy followed by
  an uncommitted/unknown DB outcome may leave an unreferenced permanent
  copy. The audit plus exact-key owner deletion improves detection and
  the ordinary remove flow, but **manual approval and a fresh authoritative
  DB read** are required before deleting any flagged orphan.
- Upload receipts still expire after 10 minutes; expired verification
  requires a fresh authorization/upload. Avoid automatic unbounded retries.
- Prior S3 signed read URLs can survive up to 60 seconds after archive.
- Antivirus, user-generated content moderation at scale, codec transcoding,
  high-concurrency quota enforcement, production cost caps and network-failure
  chaos coverage are separate operational safeguards. This PR does not grant
  production readiness.
- Do not run cleanup against user storage via scripts or AWS console without
  separate explicit authorization. No bulk deletion is implemented.

## Release
Foundation CI must pass the compiled signed-object/no-network lifecycle test
and the read-only inventory auditor. Cloudflare/Web type checks and protected
API build must pass. Founder reviews/merges the PR, then runs protected
**isolated AWS Lambda staging deployment first** followed by protected
**Cloudflare regular iPhone staging cutover**. No new bucket, IAM or Prisma
migration is required.

Device re-test with disposable files: deliberately cause or simulate a
verification-time failure, then use **Retry verification** without duplicate
upload; deliberately remove an owned disposable media object and confirm
PostMedia and S3 object are both gone; confirm old DRAFT and published media
remain untouched. Avoid intentionally interfering with live financial APIs.

Close UX011 only after reporting exact passes and remaining exclusions, not
merely from CI green.
