# Hustle isolated PWA live smoke check

This job uses no user sessions, secrets, uploads, external writes, or financial endpoints. It executes 14 anonymous GET requests against the two pinned, nonproduction origins:
- `https://hustle-ios-pwa-staging.realxpens.workers.dev`
- `https://hustle-isolated-staging-api.vercel.app`

Scope: manifest/auth/Explore/owner-page HTML, no-session behavior, authenticated route rejection, unknown storefront not found, and isolated API health at reviewed merge commit `c434f97`.

This confirms only publicly observable routing/availability, **not** actual onboarding, human approval, session restoration on iPhone, or a published Hustler. It must never seed records or manipulate the deployment/production environments.
