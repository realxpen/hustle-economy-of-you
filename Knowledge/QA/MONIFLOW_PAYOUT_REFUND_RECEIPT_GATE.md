# Hustle × MONIFlow — Payout / Refund Partner Command Receipt Gate

Date: 2026-10-13
Status: Feature PR; CI acceptance pending. **Sandbox transport test ONLY — no payouts/refunds actually executed by MONIFlow.**

## Preceding work
- Hustle PR #107 (reserve-before-dispatch) and PR #108 (read-only unknown-outcome reconciliation) are merged.
- Hustle PR #109 (real ORDER collection → MONIFlow RECEIVED) is merged at c56e869.
- MONIFlow PR #5 (partner inbox on main and CUID compatibility) is merged at 88a2b33.
- MONIFlow's current partner API persists all command kinds as **RECEIVED**; it does not verify trusted issuer references, process payouts/refunds, call BMONI, emit success events, or move funds.

## Goal
Reuse the existing pinned-MONIFlow disposable PostgreSQL workflow `.github/workflows/moniflow-sandbox-handshake.yml` to prove a genuine Hustle-initiated `Payout` or `Refund`, with durable authorization and dispatch record already committed, can be marshalled to the authenticated MONIFlow sandbox **without changing Hustle's financial authority**.

### Payout validation
1. Source: server-side, actual PostgreSQL Payout with `HUSTLE_SANDBOX` provider, stable sandbox reference, eligible nonterminal REQUESTED/PROCESSING status, strict NGN amount.
2. Match the FinancialDispatchCommand as PAYOUT, state SUBMITTED or OUTCOME_UNKNOWN; QUEUED and mismatched records must fail closed.
3. Verify one committed `PAYOUT_RESERVED` ledger transaction with exactly two matching postings: debit the user's AVAILABLE and credit their PAYOUT_RESERVED account, at the payout's original amount.
4. Build signed partner payout command with canonical payout ID, beneficiary, amount and reservation reference, and the deliberately explicit placeholder `sandbox:UNVERIFIED:no-bank-transfer:<payoutId>`. **This marker is NOT an actual bank destination.** It is never valid for a provider execution route.
5. MONIFlow returns RECEIVED/realFundsMoved=false only; repeat with a fresh signed nonce returns duplicate=true; original outcome remains UNKNOWN or PROCESSING and original sandbox provider invocation count does not increase.
6. Terminal FAILED/SUCCEEDED operations cannot issue a new partner command.

### Refund validation
1. Source: actual persisted Hustle Refund linked to a successful, domain-applied HUSTLE_SANDBOX PaymentAttempt; canonical NGN amount, linked subject and stable refund provider ref.
2. Match FinancialDispatchCommand kind REFUND, with already-submitted or uncertain provider status; for Booking require REFUND_PENDING escrow; for Order require PAID state with authorized active refund record.
3. Sign command using original payment reference and deliberately explicit `sandbox:UNVERIFIED:held-refund:<refundId>` pointer. This is **not a verified custodian or issuer authorization**.
4. MONIFlow must return RECEIVED and duplicate=true on repeat, with no provider effects or refund ledgers posted.
5. The Order remains PAID (but fulfillment still blocked by Hustle) until the **independent signed HUSTLE_SANDBOX** refund event finalizes REFUNDED; a MONIFlow receipt alone cannot cause it.
6. Terminal completed refund cannot be resubmitted.

## Security / safety invariants
- The bridge must refuse anything outside NODE_ENV=test and `http://127.0.0.1:<port>/`, and only use ephemeral test HMAC. No user-facing endpoint or DI gateway switch.
- No generic partner adapter in `PaymentModule`; HUSTLE_SANDBOX remains the only payment/financial operation gateway.
- Never interpret HTTP 200/202, MONIFlow RECEIVED, simulation receipt or opaque provider pointer as settlement.
- Existing payout/refund UNKNOWN status is NOT cleared by a second MONIFlow receipt; no auto-retries or withdrawal release.
- No real bank destination, KYC, payout signing, reconciliation evidence, legal escrow custody, production provider, customer balances or merchant payments.

## Required CI
- [ ] Foundation CI on PR head is green.
- [ ] Existing Isolated Payment Sandbox (with no MONIFlow service started) green.
- [ ] Cross-repository loopback workflow starts real MONIFlow Fastify server at pinned SHA 88a2b33 and passes genuine Hustle Order collection plus Payout/Refund RECEIVED-only and duplicate/terminal rejection tests.
- [ ] Ensure no RLS/payment regression or production credential/callback changes.

## Follow-up (separate review checkpoint)
Signed normalized return-event envelope with durable inbox/outbox and read-only reconciliation/status verification. **Do not implement fake SUCCESS callbacks from RECEIVED commands.** Real-money provider activation is a separately approved legal, KYC, merchant-rails, provider custody and operations decision.
