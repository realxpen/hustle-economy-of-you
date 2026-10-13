# Hustle × MONIFlow — Financial Operation Receipt-Only Boundary

Date: 2026-10-13
Status: Test-only integration extension, not a production payment adapter.

Hustle's existing `FinancialOperationPort` remains bound exclusively to `SandboxFinancialOperationGateway`; MONIFlow's `/internal/v1/payouts` and `/internal/v1/refunds` are still disabled-by-default, non-production-only, HMAC-authenticated RECEIVED-only command stores.

The test bridge accepts only a **PrismaClient** instance, a known operation ID, kind PAYOUT/REFUND and loopback+ephemeral secret. It derives every money field from persisted Hustle records; no caller-supplied monetary value or destination is accepted.

For payout it verifies durable dispatch status and balanced posted AVAILABLE→PAYOUT_RESERVED transfer, then signs `hustleReservationReference` as the real database ledger reservation transaction ID. The destination reference deliberately starts with `sandbox:UNVERIFIED:` because no bank destination verification/custody approval exists. This operation can only test intake and must NEVER reach a payout rail.

For refund it checks original successful domain-applied PaymentAttempt and an eligible escrow hold/PAID Order against the authoritative subject; the refund authorization reference also starts `sandbox:UNVERIFIED:`. MONIFlow receipt does not bypass Hustle's refund rules.

MONIFlow's current operation contract is version 1, partner HUSTLE, NGN minor integer amounts, UUID/CUID identities and immutable idempotency scope. The bridge keeps HMAC over exact raw request bytes, 5-minute timestamp skew, random unique nonce and no redirects. All partner receipts must affirm status=RECEIVED, simulated=true, executionStarted=false, realFundsMoved=false and no evidence. Errors and terminal operations fail closed.

No receipt triggers a Hustle wallet, ledger, Order/Booking, payout/refund status or escrow state change. Any actual provider success/failure is outside the scope of this branch and must come from independently verified provider evidence in a future separately approved adapter.
