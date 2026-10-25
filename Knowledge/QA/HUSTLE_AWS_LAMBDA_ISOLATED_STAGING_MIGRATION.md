# Hustle AWS Lambda Staging API Migration — executable handoff

**Scope:** disposable test API only; Cloudflare iPhone PWA remains on the **existing Vercel API** until separate signed-in acceptance and founder approval. No production migration, live payment processor, customer bank transfer or Neon parent database change.

## Account preflight (observed 2026-10-25)

- AWS account **707859598737**, region **eu-west-2** (London).
- Already present: GitHub Actions OIDC provider `token.actions.githubusercontent.com`.
- Created for Hustle: ECR `707859598737.dkr.ecr.eu-west-2.amazonaws.com/hustle-isolated-staging-api`. Tag immutability, scan-on-push and retain-last-10 lifecycle applied. Lambda-service image pull policy is restricted to the exact staging function.
- Created for Hustle: `arn:aws:iam::707859598737:role/hustle-github-isolated-staging-deployer`, with OIDC trust restricted to `repo:realxpen/hustle-economy-of-you:environment:hustle-aws-lambda-staging`, and an inline policy scoped to the isolated ECR repository, CloudFormation stack, execution role, Lambda function, log group and staging secret prefix.
- No Lambda function, Function URL, Secrets Manager secret or public AWS routing was created. No ECR image pushed or traffic switched.

## Deployment shape

```
iPhone PWA (Cloudflare) — existing Vercel API (untouched until cutover)
                         |
New AWS Lambda URL, eu-west-2 — Node 22/NestJS via Lambda Web Adapter
                         |
Existing *disposable* Neon child `br-dark-sunset-zay33p1s`
```

- Build: `infra/aws/lambda/Dockerfile`, repository-root build context, adapter v1.1.0, Node 22, compiled NestJS/Prisma, port 8080.
- Provisioning: `infra/aws/lambda/staging-template.yaml`: digest-pinned ECR image, 1 GB RAM, 28s timeout, 2 reserved concurrent invocations, 7-day logs, isolated Lambda execution role. This is **not** a guaranteed hard dollar cost cap.
- Credentials supplied **only** as Secrets Manager JSON references at CloudFormation deployment. No password, Neon URL, webhook signing secret or AWS access key in GitHub source, build args, workflow logs or Docker image.
- Better Auth session issuer is pinned either to the existing Vercel staging origin or to a Function URL in this one AWS account/region. During the first Lambda deployment, CloudFormation uses the old issuer only until the Function URL exists; the workflow immediately updates `BETTER_AUTH_URL` to the AWS URL via a second CloudFormation pass before testing sessions. The previously issued Better Auth secret and child auth tables must remain identical.
- Public Function URL has `AuthType: NONE` **only** to permit the already-authorized PWA server-side gateway; it is not a private network endpoint. Existing AuthGuard, exact staging route gates, invited test-account restrictions and sandbox simulation rules stay mandatory. Do not connect a production application to this URL.

## Blocker — private setup in AWS and GitHub

These are required before the **manual** AWS deployment workflow can succeed. Avoid pasting any secret value into ChatGPT, a PR comment or GitHub Actions logs.

**AWS Secrets Manager (eu-west-2):** create a JSON secret named `hustle-isolated-staging-credentials`, containing these **five** keys, with values copied securely from the current isolated Vercel staging API configuration:

- `DATABASE_URL` — exact disposable Neon child, DB `hustle_staging`, login role `hustle_child_api`, schema `public`, TLS.
- `STAGING_AUTH_DATABASE_URL` — same Neon child/role, schema `hustle_auth`, TLS.
- `BETTER_AUTH_SECRET` — preserve the **same** staging Better Auth signing secret, so existing signed-in testers are not silently invalidated.
- `HUSTLE_SANDBOX_WEBHOOK_SECRET` — preserve the current simulated-payment HMAC test secret. No live provider credentials.
- `HUSTLE_STAGING_TEST_EMAILS` — comma-separated list of the existing invited QA identities.

Store the ARN only in GitHub, never the values. Secrets Manager is billable (including while the API has no traffic).

**GitHub protected environment:** create `hustle-aws-lambda-staging` in repo Settings → Environments; restrict deployments to `main` and add the founder as required reviewer. Add these **environment variables**, not secrets:

| GitHub environment variable | Value |
| --- | --- |
| `HUSTLE_AWS_STAGING_DEPLOY_ROLE_ARN` | `arn:aws:iam::707859598737:role/hustle-github-isolated-staging-deployer` |
| `HUSTLE_AWS_STAGING_SECRET_ARN` | ARN of the new AWS Secrets Manager JSON secret |

The workflow relies on OpenID Connect temporary credentials, **not static AWS access keys**.

## Rollout sequence

1. Review/merge this PR only after Foundation CI passes. It deliberately does **not** deploy from pull requests or pushes.
2. Complete the two private setup steps above.
3. Manually run GitHub Actions → **Hustle AWS Lambda Isolated Staging API** on `main` with `I_AUTHORIZE_AWS_ISOLATED_STAGING_ONLY`.
4. The workflow asserts the exact AWS account and ECR repository; installs locked dependencies; builds the Node 22 container; pushes once to immutable ECR under the merge SHA; uses its digest in CloudFormation; creates the Function URL; updates Better Auth to the precise AWS URL; and tests public `/api/v1/health` plus a disabled payment route that must return 403.
5. Perform signed-in test-account acceptance against the AWS URL, including invitation, bearer auth, Client and Hustler roles, listing/discovery, messages, booking, sandbox escrow, review and Activity notifications. Validate Neon logs/CloudWatch without printing IDs or secrets.
6. **Separate PR:** only after the new API passes, change `apps/web/lib/api/isolated-web-proxy.ts` from its pinned Vercel origin to the exact tested Lambda Function URL. Deploy only the isolated Cloudflare Worker, then verify the same end-to-end iPhone journey. Keep Vercel alias for instant rollback.
7. Observe for errors/cost. Roll back by restoring the Cloudflare proxy's previous Vercel origin. Do not delete the Vercel API or Neon branch during stabilization.

### Costs and safeguards

AWS Lambda can bill for invocation and duration, while ECR storage, log ingestion/storage and Secrets Manager incur their own charges. Reserved concurrency of two, 28s invocation timeout, and seven-day logs reduce exposure but **do not guarantee a zero-cost bill**. Set an AWS Budget alert before unrestricted testing. No NAT gateway, EC2, RDS or paid API Gateway provisioned by the migration template.

### Why staging remains on Vercel for now

The iPhone PWA's same-origin proxy and the Better Auth issuer are intentionally pinned to the known Vercel origin. Replacing either before AWS is deployed and tested could log everyone out and break the live booking/review flow. This PR prepares a guarded parallel API first rather than risking current MVP acceptance.
