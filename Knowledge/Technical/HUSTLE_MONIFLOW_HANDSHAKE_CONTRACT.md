# Hustle — MONIFlow Sandbox Transport Contract

Date: 2026-10-13
Status: test-only bridge, pending CI/PR review.

Hustle's existing `PaymentGatewayPort` is still backed by `SandboxPaymentGateway`, and `FinancialOperationPort` by `SandboxFinancialOperationGateway`. No external adapter is configured.

## Loopback transport test
- `NODE_ENV=test` required; otherwise throw. Only `http://127.0.0.1:<explicit-port>/` accepted; reject domains, TLS external hosts, usernames, queries, path prefixes.
- HMAC secret (32+ chars) supplied ephemerally in CI; never committed.
- Canonical string: `METHOD + '\n' + PATH + '\n' + TIMESTAMP_MS + '\n' + NONCE_UUID + '\n' + SHA256(RAW_BODY)`, HMAC-SHA256 lower-hex `sha256=` prefix.
- POST media type `application/vnd.moniflow.partner+json`, no redirects, 5 second timeout.
- Command: v1 HUSTLE sandbox COLLECTION, subject BOOKING/ORDER, canonical record CUID IDs, amountMinor NGN >0, stable operation ID and idempotency key.
- MONIFlow response can only be an unexecuted RECEIVED record. Any success/paid/settled/provider-executed claim fails closed.

## Real-data source
In the dedicated localhost PostgreSQL CI test, `CommerceService.checkout` creates a canonical unpaid Order. `PaymentService.initialize` persists its pending `PaymentAttempt` using the existing HUSTLE_SANDBOX gateway. Only its persisted authoritative fields may be used to build the MONIFlow command. The browser and user cannot choose amount, payee or currency.

## Out of scope
No user-facing checkout change, app production environment change, provider activation, retry worker, funds receipt or ledger mutation due to MONIFlow. This transport smoke deliberately does not transform any MONIFlow receipt into a payment success webhook.
