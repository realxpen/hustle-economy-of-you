# Hustle Financial Dispatch Reconciliation — Read-Only Gate

Date: 2026-10-13
Status: follow-up review branch — CI and isolated database evidence pending.
Dependency: Issue #106 / merged PR #107 at f736065; proposed ADR-0069 on independent PR #105.

## Purpose
The financial dispatch P0 patch commits reserved payouts and refund holds before attempting a sandbox provider. It intentionally never blindly replays ambiguous remote outcomes. This follow-up makes those states visible **through the existing authenticated `GET /wallet/reconciliation` endpoint** without exposing a money-moving administrative command.

## State mapping (informational, not authorization)
| Persisted state | Reconciliation action | Allowed automatic retry? |
| --- | --- | --- |
| QUEUED | CONTROLLED_QUEUED_REVIEW | No; controlled operator/worker review required |
| DISPATCHING | VERIFY_PROVIDER_STATUS_NO_RETRY | No; provider may have executed before crash |
| OUTCOME_UNKNOWN | VERIFY_PROVIDER_STATUS_NO_RETRY | No; query trusted evidence first |
| SUBMITTED | AWAIT_VERIFIED_PROVIDER_SETTLEMENT | No; wait for verified callback / provider status |
| No dispatch record | INVESTIGATE_MISSING_DISPATCH_COMMAND | No; investigate legacy or inconsistent state |

The existing Payout/Refund awaiting-provider issue codes are preserved, with `dispatchState`, `recoveryAction`, `automaticRetryAllowed=false` and timestamps added. Fetch dispatches only via operation IDs resolved from the caller's authorized payments, not global outbox reads. The report executes zero financial operations or state mutations. It is not a financial-operator credential/console.

## Isolated PostgreSQL tests
- [ ] All five state mapping instructions are fail-closed (none grants auto retry).
- [ ] An ambiguous payout displays OUTCOME_UNKNOWN and its previously committed reserve; report does not create ledger writes.
- [ ] Submitted payout displays SUBMITTED and pending-provider evidence instruction.
- [ ] Payer sees an ambiguous refund with OUTCOME_UNKNOWN while seller cannot fulfill paid Order.
- [ ] Unrelated user cannot inspect another user's payout or refund command.
- [ ] Verified signed terminal callback removes operation from unresolved list and does not double-post.
- [ ] Foundation CI and dedicated Isolated Payment Sandbox CI pass on final head SHA.

## Strict no-go
No provider status lookup API has been implemented yet. This phase does **not** resolve OUTCOME_UNKNOWN automatically, initiate retries, unreserve money, issue a refund, reconcile BMONI, call MONIFlow, or activate external payments. Actual operational resolution requires validated provider inquiry and an authorized workflow with evidence and audit trail; no fabricated or client-supplied "paid" confirmation.
