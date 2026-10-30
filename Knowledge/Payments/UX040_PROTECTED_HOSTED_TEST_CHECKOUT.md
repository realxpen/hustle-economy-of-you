# UX040 — Full Paystack-hosted TEST checkout against actual Hustle financial state

**Status:** Code proposed. Actual successful hosted test payments are NOT yet claimed. No public API, hosted webhook or production deployment.

## Existing evidence and dependency

UX039 manual GitHub run [#41137623583](https://github.com/realxpen/hustle-economy-of-you/actions/runs/41137623583) passed with the real Paystack TEST initialize and verify APIs using an isolated localhost Postgres database and `HUSTLE_PAYSTACK_TEST_SECRET_KEY` in the protected GitHub environment. The two real transactions remained pending without card input.

Paystack's documented [hosted checkout](https://paystack.com/docs/payments/accept-payments/) needs a customer/browser action. Its [webhooks](https://paystack.com/docs/payments/webhooks/) need a **public HTTPS endpoint** with a configured Paystack test webhook URL. The existing isolated iPhone/Neon staging API explicitly forbids Paystack keys and financial mutations; do not override that protection.

## What the UX040 workflow adds

A new manual, main-only workflow `.github/workflows/paystack-hosted-test-checkout.yml` with protected environment `hustle-paystack-test-preflight`, the existing private test key and explicit input choice `I_AUTHORIZE_HOSTED_TEST_CHECKOUT_ONLY`.

**PREPARE (no payment executed):** In a disposable GitHub-hosted local PostgreSQL database, create synthetic User identities, ACTIVE Hustler, published Product and paid Service, Cart, Order PENDING and accepted Booking PAYMENT_PENDING. Initialize **two actual Paystack test-mode** hosted checkout links for **₦100 TEST each**. Confirm financial ledger/escrow remains empty. The finished run summary contains both test-only links; these are **visible to viewers of the Actions run** (the repository may be public). Never use personal data or real payment cards. Store only the synthetic DB dump and nonsecret manifest as a **two-day GitHub artifact**. The runner and DB stop after the preparation run.

**VERIFY (after human completes both test checkouts):** Start a second manually authorized run supplying the PREPARE run ID. Download that run's exact artifact, restore its synthetic-only state into a new disposable local Postgres, and independently verify both references using Paystack TEST's private API. Both must be genuine `success` with exact ₦100, NGN, reference and test domain, or verification fails without manufacturing payment state. The actual Hustle `PaymentService`, `CommerceService`, `BookingService`, and `WalletService` apply provider-verified success:

- Order `PENDING → PAID`, tracked Product stock decreases once, exactly one Order `PAYMENT_CONFIRMED` ledger entry
- Booking `PAYMENT_PENDING → FUNDED`, a HELD `EscrowRecord` and exactly one Booking capture entry
- Hustler starts/completes test Booking; only buyer releases test ledger escrow once, repeated release stays idempotent
- Locally generated HMAC-signed `charge.success` replay referencing that **real provider-verified transaction** goes through the actual local Nest webhook controller, independently rechecks Paystack, returns HTTP 200 and does **not** duplicate Order capture/inventory/escrow. **This replay is synthesized locally, NOT delivered by Paystack.**

The original Paystack response URLs and artifacts are not secret keys. However, a test checkout link is a bearer-like test capability: viewers of a public Actions summary can open it. The user should only trigger the protected run when ready to complete test payments promptly. No real customer data is present. All artifacts expire after two days.

## Safe operator procedure (requires separate approval)

1. Review and merge UX040 PR after passing GitHub CI. **Do not** run any new checkout by merging.
2. In GitHub Actions open **Hustle Paystack Hosted Test Checkout Acceptance (manual, disposable)**. Select **PREPARE** with `I_AUTHORIZE_HOSTED_TEST_CHECKOUT_ONLY`, leave the source ID blank. GitHub's existing protected `hustle-paystack-test-preflight` environment provides the private `sk_test_` value.
3. After PREPARE completes successfully, read its completed **Actions run summary**, open **both Paystack test checkouts**, and enter ONLY [Paystack's published success test-card](https://paystack.com/docs/payments/test-payments/) (never your real payment instrument). These are test funds, not real money.
4. Start a second run with **VERIFY** and the source **PREPARE run ID**, same explicit approval. This reads the artifact, restores the disposable test state and verifies the outcome.
5. Confirm report output says both were verified, Order paid, Booking funded and escrow held/released, ledger once-only, and local signed replay idempotent. If it fails, inspect the run logs; do not bypass the fail-closed guard or replay through production.

No actual money is moved in Paystack TEST mode. Real test API calls are only made in authorized manual workflow phases, never PR CI. PR CI merely tests safety guards and the existing mocked-provider complete financial flows.

## Remaining boundary (next separate milestone)

This is **not** a Paystack-delivered signed webhook or full iPhone checkout behind the existing deployed web app. Completing that requires a separately approved, independently isolated **public HTTPS test webhook API**, test-mode Paystack dashboard webhook settings and staging auth/security review. Never use production or the finance-disabled Neon child/AWS staging API, and never claim legal escrow custody or real settlement.

If checkout is cancelled/pending, do not infer payment from browser return. The original PREPARE artifact expires after two days; use a fresh PREPARE run after expiry. No real test card, email address or provider secrets should be pasted into GitHub discussions, screenshots or ChatGPT.
