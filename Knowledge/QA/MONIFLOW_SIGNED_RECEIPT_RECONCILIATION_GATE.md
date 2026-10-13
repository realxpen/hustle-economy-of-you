# Hustle × MONIFlow — Signed Operation-Receipt Reconciliation Gate

Date: 2026-10-13
Status: Sandbox-only implementation on review branch; no production provider or money.

## Dependency and authority
Hustle #110 is MERGED at 3ca7ef28e49b077eebaac586058824dd71ab09ad. MONIFlow #6 proposes authenticated signed proof-of-receipt readback. This gate tests only original MONIFlow partner operation `RECEIVED`; it is *not* a financial `SUCCEEDED`/provider state, custody proof, or bank settlement.

## Protocol
- The existing test-only Hustle HMAC bridge calls MONIFlow's signed GET `/internal/v1/operations/:id/receipt-evidence` with a unique nonce. Loopback URL and NODE_ENV=test are mandatory.
- MONIFlow returns its persisted command metadata signed over **raw response bytes** using HMAC-SHA256 and domain label `MONIFLOW_SANDBOX_RECEIPT_V1\n`.
- Hustle verifies the exact raw bytes and fixed strict event schema: `operation.received`, eventId `moniflow.received:<operationId>`, status `RECEIVED`, `simulated=true`, `executionStarted=false`, `realFundsMoved=false`, null provider evidence.
- Hustle independently rebuilds canonical command terms using its persisted real PaymentAttempt, or a reserved Payout+ledger, or Refund+hold, and checks matching operation ID/kind/NGN amount and canonical SHA-256 digest. Payout code must use MONIFlow Zod schema canonical field order.
- Only after verifying this data may Hustle record a single observational `MoniflowSandboxReceiptObservation` in PostgreSQL. Unique eventId/operationId and identical digest guarantees no conflicting replay acceptance.
- This receipt store is **not** a ledger, settlement, outbox, refund, wallet movement or permission grant. It is restricted to the server `hustle_api` database role. The code is not a NestJS API endpoint, is not registered as an external provider, and cannot run against non-loopback hosts.

## Required evidence
- [ ] MONIFlow PR #6 CI: exact raw response signature, tamper rejection, stable event, auth and nonce replay fail closed.
- [ ] Hustle Foundation CI: Prisma schema, migrations typecheck and Web/mobile safety.
- [ ] Isolated Payment Sandbox: no MONIFlow target configured; existing actual Hustle ledger and receipt-free flows remain green.
- [ ] Cross-repo pinned workflow: real ephemeral Postgres Hustle Order→collection/Payout/Refund, local MONIFlow Fastify + SQLite, signed command receipts, exact-source readback and **one durable record per operation** on repeated reads.
- [ ] Repeated signed readback never changes PaymentAttempt/Order/Payout/Refund/escrow status, changes a financial ledger posting or retries provider commands.
- [ ] No accepted receipt can be forged into a financial success.
- [ ] Reviewer verifies no production credentials, BMONI calls, deployed checkout changes, bank destinations, custody claims or real payments.

## Remaining work
There is no MONIFlow outbound delivery worker or Hustle production webhook for partner events. Next separate PR may add a persistent delivery outbox + **test-only authenticated event inbox**, with reconciliation requiring actual verified provider evidence for any financial outcome. BMONI KYC/person mapping, merchant collections, custody, refunds and bank rails remain blocked/unverified.
