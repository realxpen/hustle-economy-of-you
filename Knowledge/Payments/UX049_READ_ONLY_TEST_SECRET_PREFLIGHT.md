# UX049 — Separate payment-preview secret readiness (read-only)

**State:** new isolated Neon application schema has been migrated and independently verified on October 31, 2026: 61 public tables, 5 Better Auth tables, 41 application and 1 auth migrations, correct restricted runtime-role access; zero business/user data. PR #295 also merged.

**AWS:** The dedicated `hustle-payment-preview-credentials` secret exists and has changed since creation, but retains the `status=not-configured` tag. Secret **values have not been verified** by the engineering agent, and the public preview API/Lambda does not exist. Do not tag it `configured-test-only` based only on the Neon migration result.

## New protected read-only workflow

`.github/workflows/hustle-payment-preview-secret-readiness.yml` runs only by manual `workflow_dispatch` on `main` with `I_AUTHORIZE_READ_ONLY_TEST_SECRET_CHECK`. It requires the existing protected `hustle-payment-preview-api` GitHub environment and assumes **only** AWS role `hustle-github-payment-preview-deployer`.

The GitHub runner securely reads the exact AWS secret into memory (not logs), confirms AWS account `707859598737`, tests that:
- Only the five expected JSON properties exist.
- `DATABASE_URL` and `STAGING_AUTH_DATABASE_URL` target **only** direct `ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech`, database `hustle_payment_preview`, user `hustle_payment_preview_api`, and `sslmode=require` with separate `schema=public` / `schema=payment_auth`.
- Both URLs carry the same restricted runtime credential, with no pooler or staging URL.
- Independent `BETTER_AUTH_SECRET` is configured and >=32 chars.
- `PAYSTACK_TEST_SECRET_KEY` starts with `sk_test_`, not Live and not a placeholder.
- 1–10 invited, distinct test emails are configured.
- The AWS secret tag is either `not-configured` or `configured-test-only`.

The workflow prints only **PASS/REFUSED reason**, tag value and test-account count—never a connection URL, password, token, Paystack key, or email address. It writes **nothing**, doesn't deploy AWS/Cloudflare, and doesn't call Paystack.

## Code deployment gate tightened

The existing manual `hustle-payment-preview-api-deploy.yml` now **pins the actual independently created Neon project/branch/host** instead of accepting any non-staging project, and runs the same private test-only credential validation **before ECR build or public Lambda deployment**. It still requires the secret tag `configured-test-only` as a separate release authorization gate. Neither step self-activates the secret.

## Next operator action

After the PR is green and merged, run GitHub Actions → **Hustle TEST Payment Preview Credential Readiness (read-only)** → `main` → `I_AUTHORIZE_READ_ONLY_TEST_SECRET_CHECK`. If it fails, correct **only** the dedicated AWS secret fields through the AWS console—do not paste secret values into chat or logs. If it passes, independently review and update only that AWS secret's tag from `not-configured` to `configured-test-only`.

**Important:** Tagging or passing the preflight does not authorize public API deployment. That still requires a separate explicit founder approval, main-branch manual release, and restricted Cloudflare credentials. Existing staging, production and Paystack Live must remain untouched.
