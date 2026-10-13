# Hustle × MONIFlow — Phase 00 engineering audit

Date: 2026-10-13
Status: Proposed, sandbox only; NO connection, no production changes.
Related: ADR-0069; MONIFlow `docs/HUSTLE_PARTNER_INTEGRATION_V1.md`.

## Existing source paths (verified at main)
Hustle:
- `apps/api/src/payment/payment-gateway.port.ts`: initialize collection, verified webhook.
- `apps/api/src/payment/financial-operation.port.ts`: payout/refund and verified operation callbacks.
- `apps/api/src/payment/payment.module.ts`: both tokens resolve to `SandboxPaymentGateway` / `SandboxFinancialOperationGateway`.
- `apps/api/src/payment/payment.service.ts`: canonical booking/order amount and ownership, webhook idempotency, ledger capture and domain application.
- `apps/api/src/payment/wallet.service.ts`: user ledger-derived balances and customer-authorized release.
- `apps/api/src/payment/financial-operations.service.ts`: payout/refund initiation and callbacks, reconciliation. WARNING: provider invocation precedes payout reservation/refund hold transaction.
- `Knowledge/Technical/ISOLATED_PAYMENT_SANDBOX.md`: disposable payment integration test; not a real PSP test.

MONIFlow:
- `packages/shared/src/partner-contracts.ts`: proposed *new* strict v1 schema (code only, no routes).
- `apps/api/src/services/financial-provider/provider.ts`: internal `bmoni` vs `moniflow-sandbox` gateway; BMONI interface has wallet, KYC and offramp, not merchant refunds/collections.
- `apps/api/src/routes/operator.ts`, `routes/execution.ts`, `routes/wallet.ts`: mobile/demo routes accept `localUserId`; not partner-authorized external endpoints.
- `docs/BMONI_INTEGRATION.md` and `PROJECT_STATE.md`: documented current provider blocker and scope.

## Proposed integration boundaries; not implemented
Hustle new server-side `MoniflowPaymentGateway` implements `PaymentGatewayPort` and separate `MoniflowFinancialOperationGateway` implements `FinancialOperationPort`. Configure only after new persistent state/dispatch design; preserve `HUSTLE_SANDBOX` as the safe default.

MONIFlow `/internal/v1/*` partner API is a future isolated module and must NOT share `/api/operator` user-ID based privileges.

Contract:
- Operation IDs durable and unique per partner + environment. Monetary value NGN *minor units* (not float).
- Incoming event must be cryptographically verified and bind unique event ID, tenant identity, operation ID, subject, provider, amount and currency.
- Confirmed payment must have independently verified provider evidence and exactly one Hustle ledger capture.
- Refund/payout remote API responses represent initiation only. Completion is an independently verified terminal provider state; unknown is NOT failed and NOT succeeded.
- A BMONI NGN VBA may be person- or wallet-scoped, not an Order ID. Do not infer deposit-to-order mapping from customer-provided reference or raw amount. Unmatched transfers must remain unallocated for operator review.
- Provider-held NGN vs CNGN wallet money and MONIFlow Pockets are separate from Hustle's liability and escrow ledger.

## Security test inventory
- Token absent/expired/wrong audience/scope and cross-tenant identity → DENY.
- Valid identity but spoofed `partner` or `localUserId` → DENY.
- Replayed signed webhook (same event ID) → one processing result.
- Valid signature but wrong operation amount/currency/provider/beneficiary → no financial mutation.
- Provider succeeded but DB transaction failed → pending reconciliation, no second charge.
- Bank payout succeeded but callback dropped → no second payout, status pull verifies.
- Concurrent payout to same user → no negative AVAILABLE.
- Refund requested while escrow released/paid out → DENY until financial recovery decision.
- Rejected/failed payouts release RESERVED once; unknown payout reserves retained.
- Financial credentials, PINs, wallet private keys, national IDs and full bank details never serialized in event logs.

## Gate/sequence
00 docs + strict schemas and source review; P0 separate durable money-ordering patch (must pass isolated tests).
01 secure partner API + durable operation table and inbox/outbox.
02 simulated end-to-end integration using disposable databases.
03 BMONI provider-proof work only after sandbox 409 mapping and KYC/rail issues resolved.
04 production PSP decision, custody/legal/compliance, then explicit human authorization.
