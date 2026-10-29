# UX011 — iPhone direct S3 transfer failure: safety patch

Status: review PR only; no AWS/Cloudflare deployment performed by this change.

## Evidence (29 October 2026)
Two successive iPhone Safari screenshots showed a saved empty DRAFT and the
generic red message "Direct media transfer failed. Check your connection."
Signed-in staging database confirmed the two NEW drafts each had **0 PostMedia**.
S3 inspection in isolated account 707859598737, eu-west-2 confirmed no pending
objects and no uploaded objects under the first failed draft. The previously
accepted MOV draft retained one video until its owner deliberately removed it.
After removal, read-only Neon and S3 both confirmed 0 PostMedia and HTTP 404 for
the exact removed video key; other media remained intact.

S3 CORS permits POST/GET/HEAD from ONLY
`https://hustle-ios-pwa-staging.realxpens.workers.dev`; public access is blocked,
and the isolated Lambda is healthy. Lambda logs cannot reveal an opaque
Safari-to-S3 network error because object bytes do not pass through Lambda.
No authoritative evidence distinguishes unreliable mobile connectivity from a
Safari extension/privacy blocker, inaccessible cross-origin response, dropped
mobile connection, expired signature or other network-layer behavior.
**Do not present any of these hypotheses as a confirmed root cause.**

## Scope of this patch
- The existing secure, owner-scoped, short-lived direct-to-S3 POST is retained.
  No general-purpose upload proxy, third-party storage origin, public bucket,
  AWS secret in browser code, new IAM permissions, payment access or DB change.
- Browser XHR now reports distinct NETWORK, TIMEOUT, HTTP 403/413 or generic
  HTTP status categories, without exposing upload fields, receipt, storage XML
  response or user information.
- A weak mobile connection has up to **270 seconds**, staying below the
  signed POST policy's five-minute lifetime. Upload progress still caps at
  99% until authoritative DB confirmation.
- The editor remembers the **single signed receipt/key in in-memory React
  state** once the API authorizes it, *before* starting the S3 transfer.
  If Safari loses the reply, the owner can explicitly choose
  **Check earlier upload first**. That operation attempts the same server
  confirmation and attaches to an existing DRAFT only if the server verifies
  an existing object and authorizes the signed owner/receipt.
- If the check does not succeed, **Retry private transfer** reuses the SAME
  signed pending object key for the SAME file while its policy has at least
  30 seconds remaining. Once expired it requests a fresh signed upload,
  and the existing one-day pending lifecycle handles old temporary keys.
  Neither recovery nor transfer publishes the post.
- Cancel clears the pending transfer and cancels its XHR. Changing or
  removing the selected file also clears the receipt. A successful commit
  clears it. The receipt is NOT written to browser storage or analytics.
- A previous full upload whose confirmation failed still uses the existing
  "Retry verification" action without transferring bytes again.

## Automated CI
`scripts/experience/check-ux011-browser-transfer-recovery.cjs` transpiles
the actual Web client module under a mock browser and simulates successful
204, network status 0, timeout, HTTP 403, 413 and 503, user cancellation,
wrong S3 hostname, mismatched upload size, ticket expiry and editor recovery
contract. No external network or cloud storage is called.

## Staging release & manual acceptance
After review and all CI checks succeed, merge the PR and deploy ONLY the
**protected Cloudflare regular staging Worker** workflow from main. It is a
Web-only patch, so do not repeat AWS Lambda, S3 or IAM deployment.

On the iPhone, use a disposable non-sensitive image. On success, ensure one
media attachment appears. On failure, tap **Check earlier upload first**
before **Retry private transfer**, and report the diagnostic message, not
the private receipt or authorization. Verify no duplicate attachment and no
publication. Do not create repeated disposable uploads if an error persists.

UX011 remains OPEN until this behavior is physically accepted; unexpected
transfer errors may require follow-up browser/network repro evidence. Other
production safeguards (moderation, transcoding, usage cost monitoring) remain
separate release gates.
