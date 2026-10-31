# UX045 — Actual test-only AWS provisioning, separate Neon dependency

Verified on **31 October 2026** using the connected AWS and Neon accounts.

## AWS resources CREATED and independently VERIFIED (eu-west-2)

| Resource | Exact identity | State |
|---|---|---|
| AWS account | `707859598737` | Verified |
| ECR repository | `hustle-payment-preview-api` | Created, image tags IMMUTABLE, scan-on-push, seven-day untagged image cleanup |
| IAM OIDC deployment role | `arn:aws:iam::707859598737:role/hustle-github-payment-preview-deployer` | Created with 9 scoped inline policy statements; separate from existing staging role |
| GitHub OIDC trust | `repo:realxpen/hustle-economy-of-you:environment:hustle-payment-preview-api` and audience `sts.amazonaws.com` | Exact dedicated environment only; repository branch protection/reviewers must additionally be configured at GitHub |
| Secrets Manager record | `hustle-payment-preview-credentials` | Created, encrypted at rest using service default. Contains **unusable NOT_CONFIGURED placeholders**, tagged `status=not-configured`. No real/staging/prod credentials copied |

The approved AWS setup **did not** create the CloudFormation stack, IAM Lambda execution role, Lambda function, public Function URL, Cloudflare Worker or a live payment account. It did not touch existing `hustle-isolated-lambda-staging` resources.

The stored secret record may incur AWS Secrets Manager charges even before activation; AWS lists pricing by secret-month and API usage (see https://aws.amazon.com/secrets-manager/pricing/). The ECR repository currently has no images; future storage and compute may incur separate costs.

## Neon separate test project CREATED and verified

The founder created a **new, unrelated** Neon project on 31 October 2026, verified via the connected Neon API. Neon uses the default branch name `production` even for this independent, empty **nonproduction TEST** project; do not confuse its branch name with the production Hustle database.

| Non-secret resource | Verified identity |
|---|---|
| Project | `hustle-payment-preview-isolated` |
| Neon project ID | `fragrant-field-59689896` |
| Branch ID | `br-curly-leaf-zat0ec8m` (branch label `production`) |
| Region | `aws-eu-west-2`, PostgreSQL 17, Neon Free |
| Dedicated database | `hustle_payment_preview` |
| Separate, direct unpooled host | `ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech` |
| Dedicated role | `hustle_payment_preview_api`, created and verified |
| Application schema | `public`, empty |
| Dedicated Better Auth schema | `payment_auth`, created and empty |

Postgres permissions were checked live: dedicated role can CONNECT and CREATE in both schemas. **No production/staging data, migrations or application users were imported.**

Neon's generated connection-string API defaults to a **pooler** host and may append `channel_binding=require`; UX042's startup contract intentionally needs the **direct** host above and only the `sslmode=require&schema=public` / `schema=payment_auth` URL parameters. A secure operator must copy the dedicated role password within the Neon console and configure exact **unpooled** URLs in AWS Secrets Manager. Do not paste connection strings/passwords into GitHub, chat or a PR.

A programmatic transfer of Neon credentials to AWS Secrets Manager was **blocked by safety controls**. No retry/workaround was used. The AWS secret was rechecked and is still tagged `status=not-configured`, with its original single inactive version. The application migrations and authentication-table initialization **have not yet been applied** to this fresh test database.

## Deployment credentials — still INACTIVE

Never pull existing production/staging credentials into this preview. A secure authorized operator must populate **only** the new secret with the reviewed values:
- `DATABASE_URL` and `STAGING_AUTH_DATABASE_URL`, both using the dedicated Neon project/database/role with different schemas
- `BETTER_AUTH_SECRET` random private value (at least 32 characters), and a small allowlist of invited test email accounts
- `PAYSTACK_TEST_SECRET_KEY` starting with `sk_test_` and never `sk_live_`

Only after independent verification should the **Secrets Manager tag `status`** be changed to `configured-test-only`. UX045 has added a manual deploy **fail-closed gate** that checks this metadata before building or publishing any Lambda, with no secret values read or logged.

## Startup compatibility fixed before any AWS deployment

The merged UX042 startup guard initially rejected `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. AWS Lambda automatically supplies temporary session credentials from its limited execution role; this would have prevented *every* preview Lambda startup. UX045 accepts such credentials **only** if the runtime has the exact dedicated `hustle-payment-preview-api` function name, London region and all standard temporary credential fields, while rejecting credentials in local/staging contexts. Source: https://docs.aws.amazon.com/lambda/latest/dg/configuration-envvars.html

The UX044 manual deploy also previously requested unnecessary public ECR credentials; UX045 removes that step to avoid requiring unrelated permission in the constrained GitHub OIDC role.

## Still blocked — do not dispatch deployment

1. **Completed:** verify new Neon test project, database, dedicated API role and empty `public` / `payment_auth` schemas. **Still pending:** apply the existing reviewed Prisma app and Better Auth migrations to this fresh test database using a protected credential channel.
2. Configure the new AWS secret with two nonpooled database URLs, a unique random Better Auth secret, invited internal test email addresses and a private `sk_test_` key **through AWS's protected console**. Confirm the `configured-test-only` metadata tag only after all values and isolated schema migrations are verified.
3. Configure **GitHub environment `hustle-payment-preview-api`**, main-branch deployment policy, human reviewers, and separate narrow Cloudflare deployment credentials. The AWS OIDC role cannot be assumed using an ordinary PR token.
4. Review CloudFormation's public Function URL model and costs; explicit separate founder deployment approval remains mandatory. Do not modify Paystack TEST webhook URL yet, and never change Live settings.
5. Only then dispatch the manual `Hustle Dedicated Paystack TEST API Backend + Edge` workflow with the new project/branch/host IDs.

No production or staging database is shared; no public endpoint or live payments are enabled.
