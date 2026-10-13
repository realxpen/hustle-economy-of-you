# Signed return-receipt authority boundary

Only independent proof of stored MONIFlow partner-command intake is being added. A receipt must never mark a Hustle Order paid, a Booking funded, a wallet credited/debited, an escrow released or a Payout/Refund completed.

At test-time, after a genuine Hustle command reaches MONIFlow, an authenticated GET retrieves MONIFlow's own persisted operation-received event. The event is HMAC authenticated over byte-identical payload, its original command hash is compared to re-derived Hustle terms, and the observation is inserted at most once into a server-only durable table. All pre-existing Hustle financial operation and ledger processors remain unchanged; the sandbox provider remains the sole DI gateway.

This *pull-based signed evidence* is a stepping stone toward return events; it is **not** a pushed callback, does not speak to BMONI, and is not a payment/provider confirmation. Tests use throwaway HMAC keys and isolated SQLite/PostgreSQL databases. Any future external callback or settlement status requires a separately reviewed source-authenticated signed event schema, durable inbox, validated provider authority, tenant+reference+amount reconciliation, and explicit go/no-go review.
