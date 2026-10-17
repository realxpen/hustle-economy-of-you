# Hustle cloud staging isolation gate — prepared, not activated
Date: 2026-10-17
AED: Architecture → Build → isolated System Activation → Shadow → Observation

## Established facts
- Owner reviewed and merged mobile PR #127, cloud preview PR #129 and Expo-ID fix PR #133.
- Expo preview is linked under @xpen with public project UUID `b52b03ef-37f1-4bdf-ab42-5c80e5988ec4`. No Expo Android/iOS preview build has been launched.
- Vercel `staging-hustle-api` project already exists (`prj_LInHffCHWvwaaeMPxEhOxgQwVOyC`) and previously had **zero** configured project environment variables; we added **only** `HUSTLE_DEPLOY_ENV=staging` for its production, preview and development Vercel targets. In this context `production` is Vercel's **deployment target for the separate staging-only project**, NOT Hustle's live API project.
- Supabase projects visible to the connected account: live Hustle `pfgarmyygybmhiiuopym`, active MONIFlow `rtcjismwbrvulccryyau`, paused Personal OS `vkedlbnvehgfenmwgqrw`. **No staging Supabase Auth/PostgreSQL project yet.**
- Supabase Free grants two **active** projects across owner/admin Free organizations (https://supabase.com/docs/guides/platform/billing-on-supabase). Both active slots currently appear occupied. Creating a third may require payment, so a cost quote and **specific owner consent** are required before creation. Do not pause/delete/repurpose Hustle, MONIFlow or Personal OS to free a slot automatically.

## What this PR prepares
1. Runtime guard in both `apps/api/api/index.ts` (Vercel) and `apps/api/src/main.ts` (standalone). Only when `HUSTLE_DEPLOY_ENV=staging`, the API **fails startup** if the stage Supabase URL, project reference and Postgres connection are missing/mismatched. It rejects the live Hustle database and the two unrelated Supabase projects. For pooled URLs, the username must embed the matching stage ref.
2. Under staging mode, all mutation methods on `/payments`, `/wallet`, financial gateways, `/cart/checkout`, `/orders` and `/bookings` are HTTP 403. Read-only booking availability and separate fake/test users' posts/likes/comments remain available. Existing production API runtime behavior is unchanged.
3. EAS Android/iOS preview queue now pulls the **Expo EAS preview environment**, privately validates `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, staged ref and disabled booking flag before consuming a free build allowance. Rejects live Hustle project even if the user mistakenly puts it in EAS. No runtime values printed, pasted into source, or archived.
4. Source/behavior regression tests in the regular GitHub Foundation CI and Mobile Cloud CI.
5. **No Supabase project, staging schema migrations, production backup, external web deployment, mobile build, real funds or credentials created/moved by this PR.**

## Gate A — separate Supabase project (requires explicit owner confirmation and pricing)
- Ask the owner which Supabase organization will own `hustle-staging`; existing org is labeled `realxpens-5117's projects`.
- Call the connected Supabase cost quote for that exact organization and explain any nonzero charge. **Never** spend or change a live project without approval.
- If the plan/cost is approved and a separate project is created, record its **public** new Supabase project ref (not the DB password or secret role token).
- Use `eu-west-1` for proximity to current live project unless the owner chooses otherwise; this is not a duplicate of live data.
- Prepare **schema-only** fresh-stage migrations in an isolated environment. Existing production has diverging Prisma/Supabase migration ledgers, so do not copy its migration ledger or run unreviewed `prisma migrate deploy` against it. Validate a fresh database separately and keep `hustle_api` role/RLS logic equivalent before activation.
- Never restore production customer records, authentication users, wallets, payments, real PII or storage assets into staging. Use invented non-personal accounts and sample posts/services.

## Gate B — staging Vercel API (currently exists but not activated)
- Keep project `staging-hustle-api` separate from production project `api`.
- The marker `HUSTLE_DEPLOY_ENV=staging` is already configured on the **staging** Vercel project only.
- Once Gate A is verified, configure on **staging-hustle-api only**: `DATABASE_URL` (private new stage Postgres connection), `HUSTLE_STAGING_SUPABASE_REF` (new stage project ref), `SUPABASE_URL` (new stage Supabase HTTPS URL), `SUPABASE_PUBLISHABLE_KEY` (matching stage publishable key), with any other reviewed API runtime values. Do **not** reuse the existing production `DATABASE_URL` or publishable Auth project.
- Do not deploy until schema readiness and security checks pass. Check stage endpoint is genuinely `https://<staging-host>/api/v1`; do not substitute a production API URL.
- Stage financial and booking mutation routes remain denied even with a deliberately created test account.

## Gate C — Expo cloud-only preview and tests
- In [Expo @xpen/hustle settings](https://expo.dev/accounts/xpen/projects/hustle), select **Environment Variables → preview** and configure nonproduction `EXPO_PUBLIC_API_URL` (validated stage API URL ending `/api/v1`), `EXPO_PUBLIC_SUPABASE_URL` (stage Auth project URL), and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (stage publishable key). These EXPO_PUBLIC values are embedded in mobile builds; **never** provide service-role or DB secrets here.
- In GitHub **`mobile-preview` Environment variables**, add public `HUSTLE_STAGING_SUPABASE_REF` matching the stage Supabase project. The existing `EXPO_TOKEN` remains in environment **secrets**.
- Booking remains forcibly disabled via `EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=false` in `eas.json` and the GitHub workflow, with stage API-side enforcement.
- **Only after** Gate A/B and credentials are verified, explicitly approve a GitHub `Hustle Mobile EAS Preview (manual)` Android build. Any Expo Free quota consumed must be deliberate.
- Verify actual Android APK installation, Supabase stage sign-in, video load, scroll, comments/replies, likes/saves/follows, stage search, attached service and read-only booking slots using **synthetic** users. iOS simulator build is optional and not equivalent to physical iPhone distribution.
- Do not claim real-device acceptance, financial flows or working backend until observed.

## Stop conditions
Any proposed `DATABASE_URL` or `SUPABASE_URL` pointing to `pfgarmyygybmhiiuopym`, MONIFlow or Personal OS must be refused. Unknown project, missing staging ref, absent key, insecure URL, failed RLS/schema, or unclear cost must stop the rollout. No migration or production deployment is part of this task.
