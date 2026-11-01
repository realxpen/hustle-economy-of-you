# Hustle — AWS production API + founder-approved Cloudflare V1 UI

**Target UI (unchanged):** https://hustle-economy-of-you.realxpens.workers.dev/
**Source branch:** `preview/hustle-v1-posts-stories`
**AWS:** account `707859598737`, London `eu-west-2`
**API framework:** existing NestJS + Prisma built as an immutable Docker image, hosted by a *dedicated* production AWS Lambda URL
**Auth:** existing production `SupabaseAuthService` (NOT staging Better Auth)
**Frontend:** existing `ui-preview/dist` on the exact Cloudflare Worker, with a same-origin production gateway

## Current blockers — checked November 1, 2026

- In connected Supabase projects, `hustle-economy of you` (ref `pfgarmyygybmhiiuopym`) is **INACTIVE**. A production identity service cannot be verified until this is restored/approved.
- AWS account has **only** `hustle-isolated-staging-api` and `hustle-payment-preview-api` Lambda functions in London. No dedicated production Lambda, ECR repo or production Secrets Manager secret was identified.
- The AWS tool session identifies as the **root** principal. Do not deploy production as root. The protected GitHub OIDC role `hustle-github-production-deployer` must be provisioned and restricted to approved production resources only.
- AWS account budgets/alerts and spending permissions must be reviewed before paying for ECR storage, Lambda execution, CloudWatch ingestion and Secrets Manager.
- Cloudflare deployment API access isn't connected to this chat. A protected GitHub Actions production environment with `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `HUSTLE_SUPABASE_PUBLISHABLE_KEY` must be configured by the authorized account owner. Never paste secrets here.
- The production DB must be backed up, independently identified and schema-compatible with the current Prisma client, including the reviewed account `primarySkill` and `interests` columns. An existing candidate SQL in `backend-readiness/account-preferences/` is **not automatically deployed**. The 41-migration recovery inventory remains unchanged.

## Production deployment design

1. Prepare a dedicated AWS ECR repository `hustle-production-api` with immutable image tags and scan-on-push; do not reuse staging repositories.
2. Create a Secrets Manager JSON secret `hustle-production-api-credentials` in eu-west-2 with keys `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. The Supabase URL must identify the approved Hustle production project, and database credentials must be for the production application role, TLS enforced. No payment/provider secrets needed.
3. Verify production Supabase Auth, production schema readiness and recovery. Do not perform any production schema mutation as part of this code review.
4. Bootstrap GitHub OIDC role `hustle-github-production-deployer` with trust for only the repository and GitHub protected environments `hustle-aws-production`, `hustle-cloudflare-production`. Grant only production stack/ECR/secret read permissions; no staging, parent Neon, billing, account root, user data dumps or unrestricted IAM.
5. On the reviewed exact preview-branch SHA, after green source tests and explicit cost acceptance, manually dispatch **Hustle Production API on AWS**, choose `I_AUTHORIZE_HUSTLE_PRODUCTION_API`, approve the `hustle-aws-production` protected environment. The workflow builds a digest-pinned API, deploys a separate CloudFormation stack, checks health and verifies anonymous `/api/v1/auth/me` responds 401. It does **not** switch Cloudflare or enable financial providers.
6. Configure protected Cloudflare `hustle-cloudflare-production` environment and explicitly dispatch **Hustle Cloudflare V1 to AWS Production**. It validates the AWS production Lambda, production Supabase health, V1 UI source and tests; deploys exactly `ui-preview/wrangler.production.jsonc` with `HUSTLE_UI_API_MODE=aws-production`. The unchanged original Feed, Stories, Explore and onboarding assets remain the UI.
7. Validate iPhone Safari and Waydroid end to end: real signup/login/email verification; session refresh and logout; username availability; duplicate/reserved usernames; onboarding profile persistence, skills/interests/area, guest browsing, inaccessible account without auth. Confirm payments/escrow and unsupported creator functionality remain disconnected.
8. Observe CloudWatch and Cloudflare errors, request rates, auth failures and budget alerts. Roll back the Cloudflare Worker to the last known-good reviewed V1 deployment if auth/DB integration fails. Do not migrate live payments or alter the production DB as an automatic rollback.

## Security and API exposure

- The production Worker uses host-only `__Host-` HttpOnly/Secure/SameSite cookies. It holds Supabase access+refresh tokens server-side; browser JS never accesses them. It refreshes through production Supabase Auth and forwards access tokens as Bearer to AWS NestJS `AuthGuard`.
- The public AWS Lambda Function URL uses application bearer authentication for all private routes, plus origin-restricted CORS; **CORS alone is not a security boundary**. Further abuse limits (Cloudflare/WAF/rate limit), logs and availability monitoring are production prerequisites.
- Worker BFF routes are explicitly allowlisted: sign-in, sign-up, sign-out, session, current account, account sync, username availability, profile update. No arbitrary URL proxy, finance, payout, booking, admin, escrow or provider configuration endpoints are proxied by this milestone.
- `HUSTLE_FINANCIAL_PROVIDERS_ENABLED=false`, `HUSTLE_ADAPTIVE_CORE_ENABLED=false`, no production cash movement or escrow release. No production credential is committed into GitHub.
- Profile photo uploads are disabled on this production gateway until a separately reviewed production-safe image storage flow exists. Disabled Google/Apple/password recovery remain disabled.
- Signup can require email verification; the UI now displays that truth and does not fake a signed-in account.

## Exact acceptance status

This change is a source-level production infrastructure and integration milestone, **not a completed public production cutover**. Creating a PR, merging, or passing CI does not host the API, reactivate Supabase, create secrets, migrate databases or update Cloudflare. No AWS resource and no production DB was modified by preparation of this milestone.
