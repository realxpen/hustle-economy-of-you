# Hustle — Cloudflare PWA first; AWS backend second

Decision (2026-10-24): migrate the existing iPhone UX004 Home Screen PWA to Cloudflare Workers while preparing a nonproduction AWS App Runner plan for the Nest API. This replaces reliance on Vercel's frontend deployment allowance; it is not a redesign, account migration or production cutover.

## Current dependencies and safety
- PR #204 is the native/Figma web-app interface; PR #205 is the isolated Better Auth first-party Next proxy. This branch is stacked on #205 pending review.
- Next.js 16.3, Expo SDK54/React Native, NestJS 11, Prisma PostgreSQL, restricted Neon child branch. Existing Waydroid Android APK and Expo Go tracks remain unchanged.
- The PWA has server-rendered pages and authentication route handlers. A static Pages export is NOT an acceptable substitute. Cloudflare recommends beta vinext on Workers for Next.js 16.
- A disposable GitHub CI runner executes the official vinext compatibility scan and initializer, builds output, and uploads nonsecret generated files. No Cloudflare deploy, tokens, database writes or payments in this diagnostic.
- Cloudflare preview must set HUSTLE_ISOLATED_PWA_GATE=isolated-staging on the Worker and NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=true at build-time; the existing strict proxy still blocks bookings/payments/unapproved writes.
- No production/parent DB, Supabase secret, sensitive token or live credentials in code or diagnostics.

## Acceptance and rollout
1. Review official generated Cloudflare Vite and Workers config and commit a locked alternate build path alongside existing next build.
2. Validate Cloudflare Workers build via CI; enforce manually approved deploy, restricted API token and Cloudflare account ID stored in GitHub secrets, never shared in chat.
3. Deploy a dedicated nonproduction Worker when provider access and resource-spend permission are available. Test HTTPS manifest, icon, login, same-origin session cookie, feed/search, and prohibited writes.
4. Launch actual iPhone PWA from a NEW Cloudflare Home Screen icon; verify real invited test login, session restoration, Home, Explore, Inbox, You and logout, no fake results.
5. Separately prepare NestJS on AWS App Runner Node22 with one service, TLS, private secrets, logs and AWS budget alerts; preserve Neon child-only datasource until deliberate separate migration.

## Cost and authority
Workers and App Runner are usage-metered; allowances and AWS promotional credits vary. Verify AWS credit eligibility and account region before incurring spend. There are multiple connected AWS account links and the intended account has not been selected; create NO cloud resource, billable service or database migration without identifying it.

## Known blockers
- vinext is beta and its compatibility with all current Next features must be tested, not asserted.
- No Cloudflare account connector is currently available; workflow code can be prepared but live Workers provisioning/deploy requires connected account or appropriately scoped GitHub secrets.
- Moving PWA hosting does not migrate the Vercel-based staging API. The future AWS Nest cutover must update Better Auth base URL, trusted origins and client URLs consistently without weakening Neon child identity restrictions.
- No GitHub source checks substitute for actually opening a live deployed iPhone PWA.

References: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ ; https://vinext.dev/docs/deploying/cloudflare ; https://docs.aws.amazon.com/apprunner/latest/dg/service-source-code.html

## Verified engineering evidence — 2026-10-24
- Cloudflare official vinext compatibility scan: 96% compatible, 5/5 supported Next imports, 2/3 config options fully supported; reactStrictMode partial, no blocking issues. Source: GitHub Actions compatibility artifact 12549724211.
- Cloudflare first clean build in disposable CI: passed run 40068257859. Official generated Cloudflare config, Vite CSS modules compatibility shim, workspace package and 594,412-byte lockfile were subsequently committed; no framework rewrite.
- Exact-source locked Cloudflare CI run 40069222019 PASSED: npm ci, compatibility, strict preview gates, Next UI/PWA source assertions, web typecheck, Cloudflare Worker build and actual local workerd preview HTTP checks for manifest, auth, Home and Explore.
- Exact-source Foundation CI run 40069222085 PASSED: existing Next web/admin/API builds, typechecks, responsive browser smoke and mobile integration checks.
- Exact-source mobile cloud run 40069221953 PASSED, Expo auth run 40069221925 PASSED, isolated API acceptance 40069222014 PASSED and isolated payment sandbox 40069222030 PASSED. Native Gradle CI still running when written; not claimed passed.
- AWS staging container candidate built and inspected with no AWS account access, no network in runtime inspection and no database credentials; run 40069221924 PASSED.
- Delivery workflow .github/workflows/hustle-cloudflare-staging-deploy.yml is manual-only with explicit nonproduction approval value, dedicated GitHub Environment and Cloudflare credentials exclusively from Actions secrets. No code push can deploy.

## Remaining external blocker
- The Cloudflare account is not connected as a chat-accessible provider; source work is complete but no live Worker URL has been issued, so no genuine iPhone Cloudflare acceptance has occurred.
- Prior to a live deployment, the owner should add CLOUDFLARE_API_TOKEN (minimum Edit Workers scope, account-limited) and CLOUDFLARE_ACCOUNT_ID as GitHub Actions repository or environment secrets, configure the staging Environment's optional reviewers/budget guard, then explicitly dispatch the deploy workflow on the reviewed branch. Never send token values in chat.
- The AWS account has multiple connector links; identify the correct credit-bearing account and validate eligible credits and budgets before any App Runner deployment. The backend hostname and Better Auth issuer are pinned to the current Vercel staging API, so the AWS URL cutover is a separate guarded security change.
