# AWS Lambda → Cloudflare parallel iPhone acceptance (UX008)

**Status:** PR; preview not deployed by merging. This is a nonproduction, opt-in test Worker.

## Current live and planned topology

| iPhone URL | Cloudflare Worker | API backend | Neon database |
| --- | --- | --- | --- |
| `https://hustle-ios-pwa-staging.realxpens.workers.dev` | `hustle-ios-pwa-staging` | Existing Vercel isolated staging API | Disposable child `br-dark-sunset-zay33p1s` |
| `https://hustle-ios-pwa-aws-test.realxpens.workers.dev` | `hustle-ios-pwa-aws-test` | AWS Function URL `https://hh2zi77ntrsjj3rgapko7rsjv40ztgpu.lambda-url.eu-west-2.on.aws` | **Same disposable child**, not a second database |

The AWS Worker and Vercel Worker are separate **hosts**, so their host-only PWA login cookies do not mix. They share the same disposable Neon application and Better Auth tables: bookings, balances and reviews in the test accounts are shared. Do not accidentally review a transaction twice or assume the AWS preview is a copy of data. Both are sandbox-only.

The preview displays **HUSTLE · AWS TEST**, a separate installable PWA identity, and simulated-finance caveat. Current staging Worker remains pinned to Vercel in its default build. The AWS preview never uses an arbitrary URL from a request or runtime environment; its origin is a hardcoded Lambda Function URL, selected solely by an exact, non-secret Worker binding. Unknown targets return 503.

## Safe release / rollback

1. Merge the PR after Foundation and Cloudflare compatibility checks are green. This **does not deploy**.
2. GitHub Actions → `Hustle Cloudflare AWS Lambda iPhone Preview (manual only)` → Run workflow on `main`, select `I_AUTHORIZE_PARALLEL_AWS_IPHONE_TEST_ONLY`; approve the already-protected Cloudflare staging environment.
3. Workflow checks live Lambda health (200), unauthenticated notifications (401), scoped proxy/CSRF/auth unit tests, builds the VINEXT Worker with `HUSTLE_AWS_PREVIEW_BUILD=true`, deploys **only** Worker `hustle-ios-pwa-aws-test`, then probes preview manifest and AWS login UI.
4. If the separate deployment fails, leave the original Vercel-backed staging PWA untouched. Do **not** modify the existing `hustle-cloudflare-staging-deploy.yml` job or main Worker to force a preview cutover.
5. Preview user tests need a fresh **AWS test** sign-in because AWS uses a different Better Auth signing secret. The same invited tester accounts and password hashes may be available from the shared child schema; do not use real credentials or create a new account under an uninvited email.
6. On the parallel AWS preview test as Client and Hustler: browse guest services, sign in, sync profile, open conversation, create a new test booking or inspect an existing completed one, inspect wallet simulated balance/escrow status, verify eligible reviews and Activity alerts. Confirm no duplicate release/review and no unauthorized writes. Monitor Lambda logs, errors and AWS cost.
7. **Separate second cutover PR, only after live acceptance:** switch the original Cloudflare `hustle-ios-pwa-staging` to AWS backend, then repeat the same iPhone flow and retain the old Vercel deployment for rollback.

## Preconditions / boundaries

- Lambda Function `hustle-isolated-staging-api` ACTIVE, AWS CloudFormation stack UPDATE_COMPLETE, real money providers disabled. AWS account `707859598737`, region `eu-west-2`.
- No production database, payment processor, live provider credentials, customer funds or production PWA touched.
- The same Neon test child means user actions are shared across both staging views; test with disposable fixture bookings.
- The AWS preview is a public-facing QA hostname guarded by the same allowed invited tester authentication, exact API allowlists, secure cookies, same-origin write restrictions and 10k payload cap. No sign-up outside invited email list.
- Exact cloudflare preview Worker URL is not confirmed until the manual GitHub deployment is successful. Do not claim a successful deployment solely from PR checks.
- The staging GitHub Cloudflare API token may lack permission to create a new Worker; if so, fail without changing the original, and correct only the nonproduction Worker creation permission through a reviewed action.
- AWS Lambda has a 10-invocation account-wide concurrency quota and AWS billing may apply. Cloudflare deployment may also incur usage costs.

## Automated safety contract

`node scripts/experience/check-cloudflare-aws-preview.cjs` ensures: default Vercel behavior, exact AWS selection, unknown URL rejection, only staging cookie forwarding, Better Auth Origin rewrite, CSRF denial, forbidden payment writes, separate Worker identities and PWA manifest, approved manual workflow with no push triggers.

`scripts/cloudflare/check-worker-config.cjs` now validates both deployment target identities and the existing Vercel default. Cloudflare PWA compatibility and Foundation CI run both suites before deployment.
