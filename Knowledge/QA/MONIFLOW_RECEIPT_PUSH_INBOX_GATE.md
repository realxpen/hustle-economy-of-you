# Hustle × MONIFlow — Secure test-only pushed receipt inbox

Date: 2026-10-13. Proposed, subject to independent CI. This is not a finance event or production webhook.

## Authority
Hustle is the only financial authority over wallet, ledger, Order, Booking, escrow, payout and refund state. MONIFlow's durable command inbox supports fixed `operation.received` acknowledgments only. No MONIFlow command receipt can mark any financial operation `SUCCEEDED`.

## Implementation
- New `POST /api/v1/payments/partner-sandbox/received` is mounted under Nest PaymentModule but always returns 404 unless `NODE_ENV=test`, `MONIFLOW_SANDBOX_INBOX_ENABLED=true`, and a 32+ character `MONIFLOW_PARTNER_HMAC_SECRET` is available server-side. Real deployments must not set this flag.
- `NestFactory.create` preserves the original raw HTTP request bytes with `rawBody:true`; the endpoint requires a Buffer and HMAC `x-moniflow-receipt-signature`.
- The verifier rejects malformed event schemas, any unexpected field, forged HMAC, `SUCCEEDED`, `FAILED`, `realFundsMoved=true`, non-NGN, missing evidence, mismatched operation references and monetary term changes.
- It derives all expected terms from Hustle's own real persisted PaymentAttempt or nonterminal reserved Payout / held Refund, compares canonical command SHA-256, inserts immutable server-only MoniflowSandboxReceiptObservation using unique event ID and operation ID. A legitimate duplicate receives `duplicate=true`. Conflicting payload digest fails closed.
- It never invokes payment gateways, moves funds, writes ledger postings, grants payout authorization, changes financial statuses, or releases escrow.
- MONIFlow's sender is in an independent, non-production-only branch: persistent SQLite/Postgres outbox, recoverable from durable source commands, leased at-most-once concurrent claim and at-least-once delivery; retries after failed HMAC or lost response.
- In the isolated GitHub Actions workflow, real Hustle Nest is run with disposable localhost PostgreSQL, MONIFlow Fastify with disposable localhost SQLite and randomly generated HMAC secrets. Delivery target is exactly the loopback endpoint.

## Required acceptance evidence
- [ ] MONIFlow PR #7 CI is green on exact reviewed commit.
- [ ] Hustle Foundation CI and isolated payment sandbox are green on exact reviewed commit.
- [ ] Cross-repo pinned CI verifies MONIFlow durable receipt command readback, rejected wrong HMAC push, retry after delay and successful ingest, unique stored observation, no ledger mutation or Order paid status transition.
- [ ] Additional tests for queue lease expiry, crash gap, wrong target and bounded failures, and independent auth protocol tests.
- [ ] Owner approval of both PRs required before merges.

## Remaining no-go
No production activation, real BMONI, legal custody, real bank destinations, real escrow, collection confirmations, settlement, direct AI-initiated transactions, financial SUCCEEDED events, or automatic provider outcome inference. Further events require independently verified provider reconciliation, signing key rotation/rate-limits and a separate trusted service-to-service workload identity design.
