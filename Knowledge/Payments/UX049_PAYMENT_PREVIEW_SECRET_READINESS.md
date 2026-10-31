# UX049 — Test-only payment-preview AWS secret readiness

## Verified 2026-10-31

The isolated Neon project `fragrant-field-59689896`, branch `br-curly-leaf-zat0ec8m`, database `hustle_payment_preview` has **61 public tables, five Better Auth tables, and 42 applied Prisma migrations (41 + 1)**; a dedicated restricted API runtime role can read the required user/auth tables. No production/staging data was imported.

The separate AWS Secrets Manager record `hustle-payment-preview-credentials` in account `707859598737`, London region still has tag **`status=not-configured`**. Read-only inspection of the five fields found:
- `BETTER_AUTH_SECRET`: populated, minimum length passes
- `HUSTLE_STAGING_TEST_EMAILS`: populated (syntactic contents not yet fully validated)
- `PAYSTACK_TEST_SECRET_KEY`: populated with `sk_test_` prefix (test-only, NOT a completed transaction)
- **`DATABASE_URL` and `STAGING_AUTH_DATABASE_URL`: both populated with strings that are NOT PostgreSQL URLs**. Neither begins `postgresql://`. They are invalid for the runtime. No values, passwords or account email addresses have been printed or copied.

## Action to correct the secret without exposing credentials

In the AWS Secrets Manager console (region `eu-west-2`) open **`hustle-payment-preview-credentials`**, choose **Retrieve secret value → Edit**, and replace only the two database URL values using a Neon connection URI for **`hustle_payment_preview_api`** from the *independent payment-preview project*. Do **not** copy the migration OWNER URI. Do not put URLs, passwords or test keys into pull requests, GitHub workflow inputs, chats or logs.

Each value must have exactly the following structure (PASSWORD below is **illustrative only**, not a real value):

```text
postgresql://hustle_payment_preview_api:<URL-ENCODED-RUNTIME-PASSWORD>@ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech/hustle_payment_preview?sslmode=require&schema=public
postgresql://hustle_payment_preview_api:<URL-ENCODED-RUNTIME-PASSWORD>@ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech/hustle_payment_preview?sslmode=require&schema=payment_auth
```

Use the **direct unpooled** host, `sslmode=require`, exactly the expected schema, and a real private runtime password. If Neon gives a URI with `-pooler` or `channel_binding=require`, adjust only those aspects to match the reviewed runtime contract; do not change credentials or project.

## Verify before any deployment

After this PR passes CI and merges, use the manually dispatched, **read-only**
[Hustle Payment Preview Secret Readiness workflow](../../.github/workflows/hustle-payment-preview-secret-readiness.yml)
on the main branch with `CHECK_TEST_SECRET_READ_ONLY`. It inspects only the exact test-only AWS secret and prints only safe validation results. The private value remains inside an ephemeral OS pipe; it is not echoed or uploaded. The workflow does not set tags, modify AWS/Neon resources, call Paystack, or deploy.

The existing API release workflow now independently enforces all five fields and the **exact Neon project/branch/host pins** before creating a Lambda or Cloudflare Worker. Editing the secret's status tag alone cannot bypass validation.

A green read-only result is necessary but not sufficient for deployment: keep `status=not-configured` until review of provider TEST credentials, account allowlist, the narrowly scoped GitHub environment, actual database runtime login, and separate explicit approval to expose a test-only API. No Paystack Live credentials, public checkout, payout or production endpoint is permitted.
