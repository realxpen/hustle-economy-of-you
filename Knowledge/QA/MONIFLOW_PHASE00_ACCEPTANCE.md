# Hustle × MONIFlow Phase 00 / P0 acceptance

Status: NOT ACCEPTED (architecture-only branch; no financial endpoint or provider changed).
Date: 2026-10-13

## Phase 00 review
- [x] Both current repository heads read and existing authority adapters located.
- [x] Verify Hustle is the sole Booking/Order/escrow/ledger authority.
- [x] Verify MONIFlow owns BMONI & simulated execution flows but no ready merchant collection/refund/custody capability.
- [x] Identify caller-selected `localUserId` and missing partner authentication barrier.
- [x] Identify actual provider-before-DB ordering in Hustle payout/refund.
- [x] Define proposed v1 strict sandbox contract + independent evidence requirements.
- [ ] MONIFlow schema tests green on final PR SHA.
- [ ] Hustle architecture PR green and reviewed.
- [ ] Owner approval for Phase 01/02 implementation (not real provider activation).

## Mandatory separate P0 code gate (NOT COMPLETE)
- [ ] Durable Payout reservation and outbox command committed before any external payout invocation.
- [ ] Refund authorization/hold/outbox persisted before any remote refund.
- [ ] No automatic provider retries on unknown completion.
- [ ] Duplicate and out-of-order signed provider events do not double-post ledger entries.
- [ ] Reconcile provider success/internal failure and provider timeout.
- [ ] Concurrent payout/refund/race tests pass with isolated PostgreSQL.
- [ ] No live provider/API/env secret changes; production remains HUSTLE_SANDBOX.

## Explicit NO-GO
Production MONIFlow integration or any real financial movement is forbidden until the P0 code gate, authenticated partner API, true PSP capability, regulated custody arrangement, provider evidence, finance QA and owner approval.
