# Hustle approved V1 UI — Milestone 1: authenticated identity

**Status:** Proposed implementation on `feat/ui-preview-connected-auth-v1`. Not deployed, not device-tested, and not authorized to touch production or financial systems.

## Exact integration target

The founder-approved visual is the standalone V1 Posts + Stories UI in `ui-preview/dist`, corresponding to the site `https://hustle-economy-of-you.realxpens.workers.dev/`. Do **not** replace this with `apps/web`, which has a different Next.js UI. Retain its Feed, Stories, Explore, full-screen mobile treatment and bottom navigation. Root and nested Wrangler configs use Worker name `hustle-economy-of-you`; Cloudflare deployment project / branch routing **must be verified before release**. Source changes alone do not update the deployed URL.

## Real, isolated and bounded

- The static UI loads `hustle-auth.js` before the existing V1 flows. The previous simulated code `123456` cannot sign in.
- Only email/password sign-in and sign-up for **pre-invited TEST accounts** are activated. Existing Better Auth on the independent isolated staging API enforces invitations, passwords and sessions. Phone OTP and reset are not faked or claimed functional.
- `ui-preview/worker.mjs` is a same-origin, auth-only Cloudflare Worker bridge. A **fixed, explicit** isolated API origin is used. HttpOnly host-only cookies are set on the preview origin, scoped to `/`, with `Secure` and `SameSite=Lax`. Opaque bearer tokens are resolved server-side and **never returned** to the browser, used as URL parameters or put into local/session storage.
- The Worker accepts only named auth and account routes, and enforces same-origin JSON requests, small request/response bounds, restricted cookie names, JSON response requirements, no arbitrary redirects, no access to payment, wallet, escrow, orders, booking or admin APIs.
- Successful sign-in syncs `/api/v1/auth/sync` to one canonical Hustle account. New users must finish their display name + username; `/api/v1/auth/profile` persists name, username, location and bio with server-side validation. All accounts start CLIENT; no local button grants Hustler or Agent authority.
- Existing Profile/Settings screens show the actual server identity and support profile edits and sign-out. Demonstration post counts, media, jobs, conversations and payment figures stay **explicitly labeled sample content** until each later milestone connects its own backend.
- The Worker sends no secrets at build time and never touches the main/parent database. Its only upstream is `https://hustle-isolated-staging-api.vercel.app`.

## Gate and device acceptance

1. GitHub Actions **Hustle V1 UI Preview Auth Bridge (no deployment)** must PASS on the exact final head: JavaScript syntax, isolated browser/Worker request contracts, CSRF, no token leak, no financial routes, original Adaptive source smoke, static asset and exact Worker hostname.
2. Check separate existing Foundation CI as appropriate. A green source check does **not** prove that the deployed Worker serves this commit.
3. Validate in Cloudflare that `hustle-economy-of-you.realxpens.workers.dev` is the Worker linked to `preview/hustle-v1-posts-stories` and that its build/deploy is reviewed. Keep the old deployed public UI unchanged until explicit staging release approval; do **not** dispatch a production release.
4. Verify the independent isolated staging API health, session cookie behavior, and invited tester configuration, without exposing credentials. Verify the Worker returns an anonymous `/api/preview/auth/session` response with `authenticated:false`.
5. On the reviewed nonproduction UI, founder tests Welcome → Sign-up with invited email → real account sync → required onboarding name + username → own Profile → profile edit persists after refresh → sign-out → private identity disappears → sign-in restores profile; test wrong password/uninvited email/guest browsing and slow network. Repeat on iPhone Safari and Android browser/Waydroid.
6. Any missing backend configuration, failed logins, unsupported auth provider mismatch, or inability to verify this exact Worker/branch is **BLOCKED**, not PASS. Never type a real password or test financial details.

## Next milestone

Only after founder acceptance, implement real Discovery behind the unchanged V1 look: guest Feed and Explore first, then authenticated follow/likes, posts, Stories, people and offer links. Remove or clearly differentiate fixture profiles when real server data is shown. All service requests, payments and privileged actions remain disabled until their own verified milestones.
