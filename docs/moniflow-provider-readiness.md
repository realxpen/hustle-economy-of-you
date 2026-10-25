# MONIFlow provider readiness — Phase 13, isolated gate

**Status:** Simulator contract validated; real BMONI provider onboarding and independently reconciled settlement **NOT VERIFIED**. This milestone does not connect a live payment provider.

## Verified boundaries

- MONIFlow's pinned partner contract `/internal/v1/provider-capabilities` must return a `HUSTLE` sandbox profile, durable command storage, and all five execution capabilities explicitly `false` before Hustle sends any simulated collection, refund, or payout command. A missing, inconsistent, upgraded-to-live, or unreachable response **fails closed**.
- A MONIFlow `operation.received` HMAC receipt is a durable *receipt of an instruction*, not a deposit, cleared payment, custody movement, payout, or settlement.
- The test-only BMONI-format observation verifier checks exact raw-body HMAC-SHA256, matching `X-Webhook-Id`, partner-scoped `employee.*` event names, strict envelope and isolated test-only mode. It returns `TEST_OBSERVATION_ONLY` even when a test fixture has a valid signature. **Do not call a booking FUNDED from this evidence.**
- No BMONI sandbox partner key, webhook subscription, real recipient verification, licensed payment-processor integration, independent transaction-status query, controlled reconciliation, regulated custody authorization or real payout authority has been established by this PR.
- Live staging money writes, escrow release, payment initialization, wallet and work-execution APIs remain denied. No new provider gateway is registered.

## Before enabling a real checkout

1. Obtain *dedicated*, approved sandbox partner credentials and scoped `partnerId`; no shared demo key can qualify as production readiness.
2. Register a partner-scoped HTTPS subscription for `employee.deposit.completed`, `employee.withdrawal.completed`, `employee.withdrawal.failed` and appropriate failure/refund events. Verify the dedicated secret and rotation without exposing it.
3. Independently bind each provider event **and provider-side status lookup** to a persisted Hustle payment/operation: payer/recipient, exact decimal amount and currency, settled reference, settlement state and unique event identity. Ambiguous, mismatched, stale or missing evidence must remain held for human review; do not auto-retry an uncertain payout.
4. Test provider failures, retries, signature/key rotation, duplicate collisions, out-of-order events, refunds, partial settlements and the absence of extra ledger postings or double escrow release.
5. Secure financial/escrow custody, KYC/KYB, dispute operations, compliance and partner launch authorization separately. Only then consider a distinct audited live gateway PR and explicit approval.

**Docs:** https://embedded-docs.bmoni.com/api-reference/webhooks/ and https://embedded-docs.bmoni.com/api-reference/introduction/

**CI:** `payment-sandbox.yml` and `moniflow-sandbox-handshake.yml` run against disposable local Postgres with loopback-only MONIFlow and ephemeral secrets. **Neither triggers live bank activity.**
