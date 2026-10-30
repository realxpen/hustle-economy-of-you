# UX038 — One real test-backed Product + paid-Service financial journey

## Scope

Extend the *existing* UX035–UX037 Paystack **test-only** integration and UX036 disposable-PostgreSQL acceptance instead of adding any parallel checkout, mock Cart, alternate backend or new schema.

One GitHub-hosted disposable PostgreSQL/Nest acceptance suite now exercises two canonical flows:

1. Product: Product → Cart → Checkout → PENDING Order → Paystack test initialization → signed webhook **or** authenticated buyer-initiated provider reference verification → PAID Order, inventory reduction, balanced ledger. Invalid HMAC, amount mismatch, different user, replay and delayed callback cannot double apply.
2. Paid Service: published paid Service → Client Booking REQUESTED → Hustler accepts → PAYMENT_PENDING → Paystack test initialization → authenticated buyer-initiated provider verification → FUNDED Booking and HELD test-ledger escrow → Hustler starts and completes work → Client releases → RELEASED. Provider failure/pending, amount mismatch, non-buyer verification, work before funding, early escrow release, Hustler self-release, duplicate release, and delayed webhook are checked.

The suite reuses `PaymentModule`, `BookingModule`, `CommerceModule`, `WalletService` and real DB migrations. HTTP calls to Paystack are locally stubbed, never sent to Paystack. The `PAYSTACK_TEST_SECRET_KEY` is a fake CI-only value. The database is a disposable local PostgreSQL instance guarded by the existing runner. No production data, live provider credentials, simulated custody claims or real money movement.

## What this does *not* prove

This is **not** a real Paystack-hosted checkout/browser walkthrough, payout, regulated escrow custody, production deployment, merchant KYC, or live-money readiness. Existing restricted isolated staging does not permit provider keys. A future real test-mode acceptance needs a separately authorized isolated dev API + disposable DB + private Paystack `sk_test_` configuration + test webhook.

## Acceptance evidence

`.github/workflows/payment-sandbox.yml` runs the merged sandbox regression followed by `scripts/payment-sandbox/paystack-order-end-to-end.mjs` against the actual Nest app and throwaway database. CI outcome is the acceptance source of truth; the presence of this file alone is not proof of a passing test.
