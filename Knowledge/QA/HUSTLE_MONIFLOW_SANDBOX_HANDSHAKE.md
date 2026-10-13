# Hustle × MONIFlow — Isolated Payment Receipt Handshake

Date: 2026-10-13
Status: feature branch validation pending. No production integration or actual payment execution.

## Motivation
Hustle's real database models (`User`, `Booking`, `Order`, `PaymentAttempt`) use Prisma **CUID** identifiers. MONIFlow's initial partner v1 schemas assumed UUIDs. Before test integration, the MONIFlow mainline-correction branch updates command IDs to validated CUID **or** UUID and changes its proposed PostgreSQL operation ID column to `text`. This must be on MONIFlow main before broader integration.

## Evidence requirements
The opt-in workflow `.github/workflows/moniflow-sandbox-handshake.yml` checks out Hustle under test and a PINNED reviewed MONIFlow partner API revision in a separate directory. It runs disposable localhost PostgreSQL using Hustle's existing payment sandbox rules and starts the MONIFlow *real Fastify API* with isolated local SQLite, no BMONI API key, `FINANCIAL_PROVIDER=moniflow-sandbox`, and enabled only outside production. It generates fresh HMAC credentials per CI run (never committed or deployed). No network route to an actual provider is used by the bridge.

The test creates a **genuine Order through Hustle CommerceService** and a **real PENDING PaymentAttempt through PaymentService**. The new test-only bridge `apps/api/src/payment/moniflow-sandbox-partner.client.ts` derives a strict partner COLLECTION command from the authoritative persisted attempt. Only when `NODE_ENV=test`, HMAC secret is provided, and the target URL is `http://127.0.0.1:<port>/` may it send a request to the MONIFlow partner intake. This class is NOT registered as a Nest PaymentGatewayPort and has no production feature flag.

The HMAC matches MONIFlow's exact method, request path, timestamp, nonce and SHA-256 raw body canonicalization. Test verifies MONIFlow returns only `status=RECEIVED`, `simulated=true`, `executionStarted=false`, `realFundsMoved=false`, and no provider settlement evidence.

## Acceptance
- [ ] MONIFlow mainline PR #5 (correct merge target) passes CI; owner reviews before merge.
- [ ] Real Hustle Order and PaymentAttempt CUID fields accepted as signed partner command.
- [ ] Duplicate operation is acknowledged without duplicating a partner command.
- [ ] Replay nonce is rejected; wrong secret and stale request are rejected.
- [ ] Divergent amount under same idempotency key returns conflict; USD and unknown injected execution fields fail closed.
- [ ] GET operation returns RECEIVED only; provider capabilities explicitly disable live collections/refunds/payouts/custody.
- [ ] PaymentAttempt and Order stay PENDING; ledger posting count and inventory do not change.
- [ ] Existing separate Hustle signed sandbox payment webhook proceeds through its ordinary post-confirmation tests unchanged.
- [ ] Independent Foundation CI and existing Isolated Payment Sandbox remain green; new cross-repo test workflow is green on exact commit.

## Boundaries and future work
This is an **integration transport/security smoke**, *not* a verified financial checkout, bank collection, escrow provider, charge, refund, payout, or MONIFlow operational execution. MONIFlow receipts must NEVER turn Hustle Bookings FUNDED or Orders PAID. Provider-backed fund custody, trust-bound authorization, live BMONI, settlement reconciliation, wallet signing, refunds, real transfers, and proper legal/finance review remain NO-GO.

After this gate, a separate phase can connect authorized refund/payout sandbox commands from durable Hustle dispatch records (without processing them), build signed return-event infrastructure, and eventually implement proven supported payment provider operations behind independent explicit approval.
