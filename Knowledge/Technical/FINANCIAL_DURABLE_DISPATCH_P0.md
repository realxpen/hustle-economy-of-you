# Financial P0 — Durable reserve-before-provider dispatch

Date: 2026-10-13
Status: IMPLEMENTED ON FEATURE BRANCH — CI and isolated DB tests pending; NO-GO for real PSP.
Related: Issue #106; proposed ADR-0069 in PR #105.

## Scope of this change
- Replace the two unsafe sequences in `FinancialOperationsService.requestPayout` and `requestRefund`: a real provider must **never be called before Hustle has committed the financial reservation/hold and a durable command**.
- Preserve `SandboxFinancialOperationGateway` as the **only configured provider** in `PaymentModule`. No MONIFlow or BMONI call, production money, secret, custody assumption or external worker.
- Add `FinancialDispatchCommand` rows with QUEUED → DISPATCHING → SUBMITTED/OUTCOME_UNKNOWN, allocated *within* the same DB transaction as the financial record/lock. Create unique operationId; only QUEUED may be sent.
- Extend the sandbox gateway port with synchronous, **pure local** preparePayout/prepareRefund reference reservation. This is **not** a general BMONI capability: do not implement a real adapter until its stable merchant-reference and callback correlation mechanism is confirmed.
- The user request calls the internal dispatcher only **after commit**. When a queued command is safely replayed before any attempt, the compare-and-set claim ensures it can only execute once. A DISPATCHING/OUTCOME_UNKNOWN command cannot be resent automatically, even if the provider response threw: manual provider status reconciliation is required.
- Provider references are durable before external invocation so even callbacks racing ahead of the response can be matched; provider response must match the reserved reference exactly.
- Payout reserves AVAILABLE → PAYOUT_RESERVED inside SERIALIZABLE transaction. Gateway invocation is **after** commit. Callback success/failure continues to finalize/reverse ledger only once.
- Booking refund holds EscrowRecord in REFUND_PENDING before provider call. Order refund serializes via a PAID Order row write before provider call; fulfillment checks an active/successful refund **in the same order-row transaction** before PAID → PROCESSING.
- Partial unique DB index `Refund_one_active_per_payment_idx` blocks concurrent active/successful refunds per PaymentAttempt, but allows a new request after proven FAILED outcome.

## Scope of required test evidence
The existing disposable PostgreSQL sandbox runner now exercises a real paid Order settlement → available balance → Payout with simulated lost provider response, safe unknown outcome, idempotent repeat, concurrent overspend denial, failed payout reversal, late authenticated payout success, a fresh paid Order refund with lost response, fulfillment lock, and duplicate signed refund success.
`Hustle Foundation CI` validates generated Prisma client, TypeScript and builds; `Isolated Payment Sandbox` uses disposable localhost-only PostgreSQL with a random HMAC secret and verifies authoritative financial transitions.

## Remaining issues — do not interpret P0 as fully release-accepted
1. There is **no always-on dispatch daemon**. A server crash between DB commit and the first CAS claim leaves a QUEUED command awaiting explicitly controlled recovery. Future worker must dispatch only QUEUED commands and reconcile DISPATCHING/UNKNOWN through provider lookup, not blind replay.
2. A generic real provider cannot yet guarantee preallocated reference, callback correlation, or real bank destination authorization. The sandbox gateway is the *only* approved instance of the new pure-prepare contract.
3. Persisted incident/reconciliation UX, terminal unknown reset rules, stronger transaction-level dual-control, payout destination/KYC/AML, custody/legal agreement, provider fees, refunds after settlement, and end-to-end BMONI sandbox proof remain separate release gates.
4. Provider webhook handler races, conflicting terminal outcomes and refund/fulfillment concurrency need continued attack and fault-injection testing before any real-money adapter is enabled.
5. This migration must be applied in a disposable CI database first; **never automatically apply financial migrations to production** as part of this PR. Existing financial records must be audited before eventual production migration.

## GO/NO-GO
- Go for code review/sandbox CI only after both CI jobs pass.
- **NO-GO** for MONIFlow real adapter, money movement, new funding checkout, production schema update, operational dispatch job and release until additional security, provider and legal/custody validation.
