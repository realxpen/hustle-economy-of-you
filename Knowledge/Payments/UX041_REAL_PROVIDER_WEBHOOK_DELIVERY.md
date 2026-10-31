# UX041 — Real Paystack-delivered TEST webhook, disposable Order + paid Booking

## Why
UX040 completed [GitHub run #41150322965](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41150322965): both hosted Paystack TEST checkouts verified privately against real Paystack, actual disposable Order moved to PAID, paid Booking moved to FUNDED, ledger/escrow assertions passed. UX040's signed webhook replay was **locally constructed**, not delivered by Paystack.

UX041 aims to prove a **genuine remote Paystack TEST webhook POST** passes Hustle's exact raw-body HMAC + private Paystack transaction verification + canonical Order and Booking domain operations, without exposing current finance-disabled AWS/iPhone/Neon staging and without a permanent public API deployment.

## Design (no application deployment)
- Manual, protected workflow `.github/workflows/paystack-real-webhook-delivery.yml` is restricted to `main`, the existing protected GitHub environment `hustle-paystack-test-preflight`, private `sk_test_` secret, and new **explicit** `I_AUTHORIZE_TEMPORARY_TEST_WEBHOOK_ONLY` choice.
- A brand-new GitHub runner and local disposable PostgreSQL 17 service apply existing migrations with synthetic buyer/Hustler, Product/Cart/Order and accepted paid Booking. Nest is built and initialized **without a public listener**.
- The only HTTP listener binds `127.0.0.1:44831`, serves a random 128-bit capability path `/paystack/test/...`, and is exposed by an ephemeral **Cloudflare Quick Tunnel** with pinned `cloudflare/cloudflared:2026.10.7`. This does NOT expose Nest routes, credentials, cookies, admin API, staging or production database.
- Receiver refuses wrong route/method, non-loopback direct connections, oversized/non-JSON requests, wrong `CF-Connecting-IP` (Paystack's documented source addresses), wrong exact raw-body HMAC SHA512, live environment, pending/failed states, wrong reference, amount or currency. It handles unrelated signed events as ignored acknowledgements, without financial effect.
- **Crucial:** HMAC alone never credits a transaction. The receiver calls the actual `PaymentService.handleVerifiedWebhook`, where `PaystackTestGateway.verifyWebhook` re-verifies exact signed bytes **and independently queries real Paystack TEST /transaction/verify/:reference** before changing any Order/Booking/ledger/escrow state.
- On 2 unique successfully delivered events, CI asserts Order PAID, Product stock reduced once, Booking FUNDED and escrow HELD; then executes completion and buyer-only once-only release, with exactly 2 initial payment ledger transactions and 1 escrow release. It emits a green report only on those facts.
- The tunnel and disposable DB are destroyed when the job ends, including failure/timeout. There is no scheduled job, no public production endpoint, no real money and no irreversible provider account change performed by the workflow. Existing staging financial restrictions are unchanged.

## Human-run procedure — test mode only

1. **Review/merge the PR after CI passes.** The merge **does not** open any tunnel, issue a payment or change your Paystack account.
2. Before manually running, open your **Paystack TEST dashboard → Developers → Webhooks** and note the current **TEST webhook URL** so you can restore it. *Never change the Live dashboard webhook URL.*
3. In GitHub Actions, choose `Hustle Real Paystack TEST Webhook Delivery (manual temporary tunnel)` on `main`. Choose **`I_AUTHORIZE_TEMPORARY_TEST_WEBHOOK_ONLY`** and run it when ready to operate immediately. The protected GitHub environment supplies only the existing private `HUSTLE_PAYSTACK_TEST_SECRET_KEY`. No new secret, production database or deployment is needed.
4. As the manual job runs, open its **live step logs** for `Real Paystack TEST provider-delivered Order and Booking webhook acceptance`. It prints `UX041 TEMPORARY TEST WEBHOOK URL`, `ORDER TEST CHECKOUT` and `BOOKING TEST CHECKOUT`. This is all **synthetic test data and test-only checkout links**. Those URLs may be visible to GitHub Actions readers. The completed job summary may not appear until the job stops, so use **live logs** first.
5. Update **only the Paystack TEST webhook URL** to the printed temporary HTTPS URL. Then open the two hosted links and complete each with [Paystack's official success test card](https://paystack.com/docs/payments/test-payments/), **never a real card or personal information**. Return to GitHub's live job log to see `Verified real signed Paystack webhook receipts: 1/2` then `2/2`.
6. The workflow completes when both real signed notifications have been accepted and state is correct, or fails closed after about 30 minutes. Immediately **restore the previous Paystack TEST webhook URL** (even on failure). The tunnel hostname expires when the job exits.
7. If Paystack shows delivery failures, inspect **Paystack TEST dashboard → Developers → Webhooks** for event delivery status and HTTP response, and the GitHub job log's nonsecret errors. Do not switch to Live mode, weaken the signature/IP checks, reuse the already completed UX040 references or route traffic to production.

## Evidence and limitations
- Pull-request CI exercises only **offline** receiver signature/IP/path/reference rejection and syntax, along with the existing real Nest/disposable Postgres payment acceptance with mocked provider. PR CI **does not** expose a tunnel or contact Paystack.
- Only a successful **manual UX041 run**, together with Paystack TEST dashboard showing two delivered `charge.success` events to the temporary URL, demonstrates real provider delivery. Never claim that merely creating this workflow proves delivery.
- Cloudflare Quick Tunnels are temporary and not guaranteed reliable or suitable for production. See [Cloudflare Quick Tunnel docs](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
- Paystack requires a publicly reachable webhook URL returning HTTP 200 and recommends HMAC SHA512/IP verification. The current docs list source IPv4 `52.31.139.75`, `52.49.173.169`, `52.214.14.220`. See [Paystack webhooks](https://paystack.com/docs/payments/webhooks/).
- This is test-mode only. No actual settlement, legal escrow custody, permanent webhook receiver, production merchant activation, public App API, live money or staging deployment is claimed.
