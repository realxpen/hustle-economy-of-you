# ADR-0045 — Standalone Admin authentication and automatic session restoration

Status: Accepted for implementation; production acceptance pending
Date: 2026-10-09

## Context
The standalone Hustle Admin app previously required a pasted bearer access token in Marketplace Operations, storing it in browser tab sessionStorage. All six Admin routes depended on that manual setup. The public Hustle Web and Admin domains are distinct origins and do **not** implicitly share login storage.

## Decision
- Admin uses the existing Hustle Supabase project and **the same User identity**, not a special Admin account or a second role switcher.
- Admin signs in with their own verified Hustle email/password **once per Admin browser session lifecycle**; the Supabase SDK persists, refreshes and restores their Admin-origin session automatically.
- No manually copied tokens, no shared browser storage/cookies across unrelated production subdomains, no token delivery in URLs.
- Store session under `hustle-admin-supabase-auth`; never store a separate static bearer token.
- The server's `AuthGuard + AdminGuard` and `HUSTLE_ADMIN_USER_IDS` remain the *only* authorities for protected Admin operations.
- The browser's shared Admin gate calls read-only `GET /admin/operations/overview` to check authorization before exposing dashboards; this UI check is **not** a substitute for route-level API authorization.
- Non-Admin accounts receive an access-denied screen without data; never auto-grant permissions and never convert a Client/Hustler/Agent into Admin.
- Admin signs out via the Supabase SDK, clearing its Admin-origin session; no external Web account logout occurs.
- Admin's published Supabase URL and publishable key are public browser configuration (not a service-role secret), configured per Vercel environment.
- Supabase Auth calls use a same-origin, target-limited Auth proxy consistent with Hustle Web; nothing on this proxy can mint Admin rights.
- Avoid automatic Vercel deployments. Changes go through GitHub CI and owner-controlled manual Admin deployment only.

## Acceptance
- Valid allowed Admin signs in once and reaches all six Admin routes without pasting any bearer token.
- Reload/new tab automatically restores Admin session; refresh and API calls use current SDK access token.
- Non-Admin account signs in but gets no Admin dashboard or protected API data.
- Invalid/expired credentials and network errors have recoverable screens; session refresh works without user intervention.
- Sign-out removes Admin session and returns to sign-in.
- No change to Agent/Hustler/Web sessions and no use of a browser-supplied Admin flag.

## Production acceptance — 2026-10-09
PR #71 passed GitHub CI and was deployed manually to Admin (Vercel production commit `58b3156`).

Owner-confirmed checks:
- Existing Hustle email/password sign-in, without manual bearer token entry;
- Admin overview and primary datasets load without the prior fetch failure;
- Session persists on browser refresh;
- Navigation through all six Admin pages uses the same session;
- Non-Admin login cannot access protected Admin operations;
- Sign-out returns to authentication.

Automatic refresh under an actual token-expiry cycle, invalid-credential recovery and Admin/Web session independence were implemented but **not separately runtime-tested**. The product authentication improvement is accepted based on the requested six-check production smoke test; those extra robustness scenarios remain available for future regression tests.

Production sign-off is separate from CI/build validation.
