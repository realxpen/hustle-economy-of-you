# Hustle — Connected iPhone Home Screen PWA (2026-10-23)

The founder installed the original UX004 PWA on iPhone Safari and verified the native visual shell. It showed **“Discovery unavailable — Hustle authentication is not configured yet”** in a huge panel overlapping the bottom dock. This was a real implementation defect: the existing web authentication expected Supabase, and the Vercel staging-web project had no Supabase settings, whereas the working Waydroid preview uses isolated Better Auth on the disposable Neon child database.

## Corrective implementation
- **Use the already-proven Better Auth test identity** at `https://hustle-isolated-staging-api.vercel.app/api/auth` through a **first-party Next.js server proxy**, not hardcoded production/parent Supabase credentials and not a production login migration.
- The proxy has one exact hard-pinned staging API origin. It is **inactive unless BOTH** `HUSTLE_ISOLATED_PWA_GATE=isolated-staging` (server-side) and `NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=true` (preview public identity) are present. Both must be set for the independent **hustle-ios-pwa-testing** Vercel project, preview only.
- Auth routes allowed: `GET auth/get-session`, `auth/ok`, `POST auth/sign-in/email`, `auth/sign-up/email`, `auth/sign-out`. Only the server's allowlisted disposable email addresses may create accounts. Signin requires password length >=12.
- Non-financial API: authorized `GET` of feed/search/author account/public content and `POST /api/v1/auth/sync`; **no other writes, booking, payment, escrow, publishing, privileged settings, arbitrary URL, open redirect or user-controlled host**.
- Cookie-based Better Auth session is scoped to the PWA's own HTTPS origin. HttpOnly cookie is passed server-to-server, server checks real session after login and derives Bearer for existing authenticated feed/search components. **Do not persist credentials/tokens in web storage**. All proxy responses no-store and no caching of private API.
- CSRF guard rejects POST unless same-origin, content-type application/json, JSON body <=10KB. Reject unexpected HTML/redirects; strip user-controlled forwarded headers. No API fallback to production.
- Account sync and logout now select the same auth provider; production/main web still uses its existing Supabase path when the preview flag is absent.
- UX004 screen keeps dark immersive Home/cream utility screens and five-tab capsule; auth errors link to the invited login rather than an endless retry. The large state panel is capped to avoid overlapping dock on iPhone.

## Exact staging test environment
- Vercel team: `team_k1LDAhhLOexW8Fxa1IBysc8O`
- NEW preview-only, publicly accessible test project: `hustle-ios-pwa-testing` (`prj_P3RqS15JeeJh1h3MqezS5hJNJTTn`), **no deployment yet** as of October 23 due to Vercel Hobby HTTP 402 `api-deployments-free-per-day`.
- Environment is two **nonsecret preview-only flags** above. Root `apps/web`, Next.js, Node 22, includes monorepo parent files. No production variables.
- Original SSO-protected staging-web project deployment `dpl_E277RModzbahcCEEZjxc624LuodU` was published for short-term UI testing through a single alias exception. That already-deployed artifact **does not contain this authentication correction**. The iPhone must **not** be told to expect live login at its old URL. Disable public alias exception when the new deployment is verified.

## Acceptance before calling it working
1. Exact-head Foundation CI (including actual TypeScript, Next.js build and proxy guards) green. Browser smoke doesn't substitute for iPhone testing.
2. Explicit nonproduction Next.js preview deployment on **hustle-ios-pwa-testing** is READY, reachable without Vercel SSO, with proxy environment present; verify `/manifest.webmanifest`, `/auth`, `/api/isolated/auth/get-session` (should yield no session, not 404), and `/home` without credentials. Don't attempt or log a real password in a CI test.
3. iPhone Safari: remove old Hustle PWA icon if it points to old host; open the **new verified URL** and Share → Add to Home Screen. Reuse the disposable invited test email from Waydroid; create/enter fresh test password privately; verify real sign-in, anonymous-to-authenticated feed, Explore, account sign-out, reopen/restore, and normal empty state if no posts.
4. Cross-device peer discovery/content and publishing still require reviewed PRs #200/#202 and independent staging enablement. Do not claim account sync, cookies or iOS Safari behavior works until observed. Native Expo Go/Waydroid remain separate distribution methods.

No migrations, financial providers, production password reuse or unrestricted API paths.
