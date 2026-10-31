# UX046 — Isolated payment-preview Neon schema activation

Status: **prepared but NOT applied.** The separate project and database currently have **zero application and Better Auth tables**. This milestone does not deploy the public API or change Paystack.

### Exact target (verified 31 October 2026)

- Neon project: `hustle-payment-preview-isolated` (`fragrant-field-59689896`).
- Branch: `br-curly-leaf-zat0ec8m` (`payment-preview-test-only`).
- Direct **unpooled** host: `ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech`.
- Database: `hustle_payment_preview`, PostgreSQL 17, no staging/production data.
- Owner role (migrations **only**): `hustle_payment_preview_owner`.
- Runtime role (later test API **only**): `hustle_payment_preview_api`.
- Two schemas: `public` application data and `payment_auth` Better Auth. Both verified empty.

### What was built

A manually dispatched, `main`-only, protected GitHub workflow:
`.github/workflows/hustle-payment-preview-neon-schema.yml`.

It invokes `scripts/payment-preview/migrate.mjs`, which:

1. Refuses to begin without exact repository, main, protected approval, project/branch and reviewed owner connection to the separate direct Neon host; TLS `sslmode=require` mandatory.
2. Uses PostgreSQL 17 + empty-target owner preflight before DDL. No migration runs against a populated DB, wrong user, pooled host, shared staging or production.
3. Adds test-only `anon` / `authenticated` **NOLOGIN** compatibility roles and minimal Supabase-style schema fixtures needed by Hustle's historical SQL migrations. The `auth.uid()` shim returns NULL and dummy `storage.objects` has RLS enabled; **these are NOT a running media/auth/storage provider.** Do not enable uploads/media on this preview.
4. Records the known redundant historical Story policy migration as represented, then runs existing Prisma application migrations in order (never rewrites archived migration files).
5. Runs the independent Better Auth Prisma migration against `payment_auth`.
6. Disables interactive login for `hustle_api`, grants the isolated runtime role membership and narrowly scoped database grants, then validates expected tables and role security. The test API runtime must **not** use the migration owner credentials.

All of this is **not yet executed** against Neon. CI only tests denial guards and runs its separate disposable local Postgres suite.

### Required one-time protected setup — do NOT paste credentials in chat

1. [GitHub environment settings](https://github.com/realxpen/hustle-economy-of-you/settings/environments): select or create `hustle-payment-preview-api`. Restrict to `main` and enable required reviewers where supported.
2. Add an **environment secret**, not a repository-wide secret:
   `HUSTLE_PREVIEW_NEON_OWNER_URL`, containing an **unpooled** owner connection string from the new Neon project using `hustle_payment_preview_owner`, `hustle_payment_preview`, and exactly `?sslmode=require&schema=public`. Neon sometimes defaults to a `-pooler` host or includes `channel_binding=require`; this workflow intentionally refuses both. Use an encoded password as part of the private URL. Do not place the value in PR comments or Actions inputs.
3. Once PR is merged and the protected secret reviewed, manually select GitHub Actions → **Hustle Isolated Payment Preview Neon Schema (manual only)** → branch `main` → `I_AUTHORIZE_ISOLATED_TEST_SCHEMA_ONLY`. No API/Cloudflare/Paystack deployment occurs.
4. Inspect the workflow outcome and the resulting `public` and `payment_auth` tables. Do not blindly retry a partially applied migration; the empty-database guard intentionally stops reruns.

### After this migration passes

The separate AWS Secrets Manager `hustle-payment-preview-credentials` remains tagged `status=not-configured` and holds only placeholders. Configure it **through a protected operator channel**, never by copying existing staging or production credentials or transferring secrets through chat. Use the *runtime* role's independent database password, unique Better Auth secret, invited test email allowlist and a **Paystack TEST** key. Mark `configured-test-only` only after verification. Then separately review public Lambda/Cloudflare deployment and costs before authorizing it.

Existing staging, production data, real money and Paystack Live remain untouched.

**Important:** A bootstrap of historical Supabase data policies on Neon is merely compatibility for payment-preview database schema; it does NOT implement Supabase Storage, media delivery, or a legal escrow/payment-custody service. The preview must keep unrelated user and media routes disabled.
