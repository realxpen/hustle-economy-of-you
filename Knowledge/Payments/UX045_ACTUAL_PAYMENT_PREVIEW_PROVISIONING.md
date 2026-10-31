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

## Neon project NOT CREATED

Connected Neon organization `org-gentle-math-72719637` is on **Free**. Project creation with a custom idle suspend interval was rejected by Neon (`[HTTP 412] modifying the suspend interval is not permitted on this account`). A subsequent creation call was blocked by the tool's safety controls. **No alternate creation channel or unauthorized staging branch was used.** Re-verify in the Neon console before any manual provisioning; do not bypass account restrictions.

The required *new, independent* Neon project must use:

- Name `hustle-payment-preview-isolated`; region `aws-eu-west-2` (London); PostgreSQL 17; an **empty new project**, not branched from the existing Hustle staging or production database
- New default branch, dedicated database `hustle_payment_preview` and role `hustle_payment_preview_api`
- Nonpooled SSL-enforced database URL on the new host with `?sslmode=require&schema=public`
- Independently isolated `payment_auth` schema for Better Auth; no customer/staging data
- Exact new project ID, branch ID, and host are required as inputs to `hustle-payment-preview-api-deploy.yml`. Never paste passwords or Paystack keys into workflow inputs or PR comments

Open the [Neon console](https://console.neon.tech/) for manual project creation if allowed by the account; a new project's default settings may differ from requested low-resource choices. Review free-tier quota before proceeding.

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

1. Create/review new Neon test project, dedicated database role/auth schema. Run migrations only on that NEW project after separate approval.
2. Configure the new AWS secret with valid test-only credentials through protected channels. Confirm metadata tag `configured-test-only` only after validation.
3. Configure **GitHub environment `hustle-payment-preview-api`**, main-branch deployment policy, human reviewers, and separate narrow Cloudflare deployment credentials. The AWS OIDC role cannot be assumed using an ordinary PR token.
4. Review CloudFormation's public Function URL model and costs; explicit separate founder deployment approval remains mandatory. Do not modify Paystack TEST webhook URL yet, and never change Live settings.
5. Only then dispatch the manual `Hustle Dedicated Paystack TEST API Backend + Edge` workflow with the new project/branch/host IDs.

No production or staging database is shared; no public endpoint or live payments are enabled.
