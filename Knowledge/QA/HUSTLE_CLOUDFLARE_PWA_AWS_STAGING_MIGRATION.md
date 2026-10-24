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