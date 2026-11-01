# Hustle V1 preview — milestone 1: connected authentication

**Integration target:** `preview/hustle-v1-posts-stories`
**Scope:** source changes in a review PR; no production DB, migration, runtime activation or deployment.

## Outcome

The existing `/auth` preview screen and approved split-screen layout now carry
the isolated test identity flow without creating a second standalone-looking
authentication UI. The source-of-truth API remains NestJS `/auth/sync`,
`/auth/me`, `/auth/profile`. Isolated Better Auth is used only when both
the server and web preview gates are present. The normal Supabase production
authentication transport remains unchanged.

- Invited test sign-up and email/password sign-in use the first-party
  `/api/isolated/auth` proxy. Password length is at least 12 characters.
- After a successful authenticated session is confirmed, identity caches are
  invalidated and `/auth/sync` initializes (or returns) the canonical Hustle
  account, which starts with CLIENT capability.
- A first-time, incomplete profile goes to real `/onboarding`, retaining
  a safe local `next` destination. Returning users can resume that destination
  or land in `/home`; unsafe/external destinations are rejected.
- Existing `/onboarding` saves display name and username to the actual API.
  The existing `/account` reads the real account and signs out through the
  session server; caches are explicitly cleared before leaving.
- The normal preview's Home/Explore/Stories/Feed and core UI are untouched;
  this milestone changes only login presentation and authentication handoff.
- No client session tokens or password values are put into localStorage,
  sessionStorage, logs, URLs, or test fixtures.

## CI gate

Existing `scripts/experience/check-ios-pwa-connected-staging.cjs` now asserts:
- server and browser gate fail closed;
- first-party auth endpoints and profile mutation are explicitly allowlisted;
- off-origin/invalid content type requests are denied by the proxy;
- exact safe-next and onboarding routing are tested from the real TypeScript helper;
- existing approved authShell design remains in use;
- sign-in and sign-out invalidate both bearer and account caches;
- no financial or arbitrary privileged endpoints are exposed.

Run Foundation CI, API contract tests, Expo auth, web Next.js typecheck/build and
Cloudflare PWA compatibility on the **exact final PR head**. A CI PASS verifies
source and disposable/synthetic behavior only, not a real iPhone session.

## Founder test — AFTER a READY isolated preview is verified

**Do not use an old Vercel deployment or production credentials.** The intended
environment requires `HUSTLE_ISOLATED_PWA_GATE=isolated-staging` on the
server and `NEXT_PUBLIC_HUSTLE_WEB_STAGING_AUTH=true` on the preview build,
with the approved isolated database and authenticated backend healthy. No
production project or payment account may be connected.

1. On iPhone Safari, open the verified isolated preview `/auth`.
   Confirm the approved V1 visual presentation rather than a separate test page.
2. Create an account using a **pre-invited, disposable** test email and unique
   test-only password. Check non-invited email is denied without disclosing who
   is invited. No real OTP, phone-number verification or reset flow in this
   isolated version.
3. New account must reach `/onboarding` rather than bypassing profile setup.
   Set a unique username/display name; save; check `/account` shows true
   server-owned identity and CLIENT capability.
4. Sign out; verify private account data is inaccessible. Sign in again;
   ensure onboarding is not repeated and the same profile is restored.
5. Sign out, attempt a protected service action while a guest, sign in again:
   the original safe local route must be restored after onboarding (or immediately
   when complete). An external redirect must never be followed.
6. Close and reopen the installed PWA on iPhone, then repeat on Waydroid
   using the separately reviewed connected native build if available.
   Record actual device/session results; UI snapshots and CI are not proof.
7. When offline or under slow 3G, show a bounded error and retry, not an endless
   spinner or an assertion of a valid session.

**Release gate:** This PR may merge to the preview branch after exact-head CI,
but cannot be labeled *device-tested* or deployed without an isolated hosted
preview at the merged commit and founder device acceptance.

**Next milestone:** Discovery (Feed/Stories/Explore/Search/Profile) after the
authentication device acceptance is recorded, with the same V1 UI preserved.
