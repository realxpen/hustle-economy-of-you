# UX048 — Neon owner URL normalization for protected schema-only migration

UX046's first manual run on October 31, 2026 failed **at the earliest read-only validation step** with `REFUSED: migration authority must be the exact dedicated unpooled Neon project owner and TLS database`. No Prisma migration or SQL ran. Live and existing staging are untouched.

## Why a valid Neon URL might be rejected

Neon's *Connect* dialog commonly includes the `-pooler` host and `channel_binding=require` but omits `schema=public`. UX046 expected an unpooled host with exactly `sslmode=require&schema=public`. It also checks the **migration owner** role, not the runtime API role.

UX048 accepts only these equivalent variants **for the exact approved NEW payment-preview project**:

- Host: `ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech` or Neon-generated `ep-holy-block-zauxat1w-pooler.c-2.eu-west-2.aws.neon.tech` (never any other endpoint).
- Username: `hustle_payment_preview_owner` **only**, never `hustle_payment_preview_api` or `postgres`.
- Database: `hustle_payment_preview` only.
- Protocol: `postgresql://`, nonempty password, and `sslmode=require`. Optional `channel_binding=require` is accepted. `schema=public` may be omitted or set to exactly `public`.
- Reject unknown/duplicate parameters, modified TLS, alternate roles/databases/hosts, passwords below the minimum, fragments, and unexpected ports.

Before any SQL or Prisma command, it **canonicalizes to the direct unpooled host** with `?sslmode=require&schema=public`; this preserves the unpooled migration requirement. Error messages reveal only *which constraint* was not met, never the URL, username from user input, or password.

## Next manual action after CI/merge

1. In [GitHub Environment settings](https://github.com/realxpen/hustle-economy-of-you/settings/environments) select **`hustle-payment-preview-api`** and inspect only the *name* of secret `HUSTLE_PREVIEW_NEON_OWNER_URL`. **Do not paste its value in chat or workflow logs**. If it was populated with the runtime-role `hustle_payment_preview_api` URI, replace it with the OWNER role's PostgreSQL connection URI from Neon, using the new `fragrant-field-59689896` project and `hustle_payment_preview` database. Don't use a terminal `psql` command or a connection to a pooled/different project. A standard Neon owner URI with `-pooler` and `channel_binding=require` is accepted and internally converted safely.
2. Confirm the new Neon database is still **empty**. This migration is intended to run once against an empty database; if a past run reached SQL, stop and inspect rather than retry.
3. After this PR passes CI and merges, manually dispatch [Hustle Isolated Payment Preview Neon Schema](https://github.com/realxpen/hustle-economy-of-you/actions/workflows/hustle-payment-preview-neon-schema.yml), branch `main`, `I_AUTHORIZE_ISOLATED_TEST_SCHEMA_ONLY`.
4. Confirm migration log shows both application and Better Auth tables and role access, then independently query the new Neon DB. Do not initiate API/Lambda/Cloudflare deployments or set Paystack Live credentials.

If the run still fails before SQL, its new `REFUSED:` message identifies the *field mismatch without disclosing the secret*. **Do not weaken the target identity check to get the migration to pass.**
