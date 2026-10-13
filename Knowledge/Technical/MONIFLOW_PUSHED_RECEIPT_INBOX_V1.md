# Hustle signed MONIFlow receipt inbox v1 — strict control plane

Date: 2026-10-13. Test-only API route, never provider callback.
Wire: `POST /api/v1/payments/partner-sandbox/received`, `Content-Type: application/json`, raw JSON matching the exact MONIFlow receipt structure, header `x-moniflow-receipt-signature: sha256=<HMAC_SHA256("MONIFLOW_SANDBOX_RECEIPT_V1\\n"+raw_bytes)>`.

Only `operation.received` with deterministic stable `eventId=moniflow.received:<operationId>` and immutable stored MONIFlow command digest may enter the observational table. Hustle checks the underlying PaymentAttempt, Payout reserve/postings or Refund hold before accepting the receipt. The route does not create a PaymentAttempt or perform merchant validation, authorization, provider lookups, or a financial operation.

Delivery is at least once; duplicate writes are idempotent. Invalid HMAC and mismatched terms are rejected. Failure to reach Hustle leaves the MONIFlow operation received; it does not prove money movement or release a withdrawal reserve. Only the explicitly invoked test-only MONIFlow sender with loopback restriction may call this test endpoint.
