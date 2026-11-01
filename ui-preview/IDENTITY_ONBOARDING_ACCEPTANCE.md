# Hustle V1 — Full identity/onboarding milestone (PR #313)

## Founder-approved visual reference

The founder's eight-step V1 journey preserves the existing Cloudflare Workers Feed, Stories, Explore, mobile colors and navigation. Additional reference images inform an independent username step (live availability and suggestions), a separate optional circular profile-photo step, and a login screen with email, guest access and provider availability.

1. Goal — hiring, offering a skill, or both.
2. Display name — user-facing name, not required to be unique.
3. Username — unique 3–30-character @handle; 380 ms debounced authenticated availability, suggestions, reserved-name check, server uniqueness at write time; no account enumeration of emails.
4. Profile photo — optional image picker, on-device compression to WebP (<=256 KB), and **only if configured** an R2-backed upload with a confirmed canonical profile URL. Otherwise a local preview is explicitly unsaved. The backend does not accept a claimed successful upload without storage.
5. Primary skill — one searchable professional skill; not a Hustler verification or a qualification.
6. Interests — separate multi-select, up to 10 topics.
7. Area — general location by user search or explicitly requested coarse geolocation; optional map preview; no precise GPS persisted.
8. Ready — backend confirmation; save account identity/preferences to isolated API and restore on next sign-in.

## Login provider truth

- Real invited test-account email/password and HTTP-only staging session: supported in code; hosted isolated activation must be verified.
- Continue as guest: browse UI without authentication.
- Google / Apple: visible **disabled** until isolated Better Auth is configured with legitimate OAuth client IDs, client secrets, callback URLs, anti-CSRF state and tested first-party cookie handling.
- Forgot password: visibly unavailable until a password-reset mail delivery service and safe callback URL are configured and tested. Do not show a fake recovery success.
- Do not use actual/production credentials to test this environment.

## Avatar storage prerequisite

The Worker has an optional **`HUSTLE_AVATARS` Cloudflare R2 binding**. No R2 bucket or binding was created, no production image store was accessed, and neither Wrangler file unconditionally declares a missing bucket.

For an isolated preview release, provision a dedicated **test-only** R2 bucket; add a reviewed binding named `HUSTLE_AVATARS` to the exact Cloudflare Worker environment (separate from production assets). Deny cross-environment credentials. A signed-in test account uploads image/WebP only through a first-party route, with a 256 KB stream cap, a server-generated unpredictable filename, fixed MIME-type response, and a backend-confirmed `User.avatarUrl`. Delete orphaned candidate on profile update failure. User account photos are public to those who possess their generated URL; **do not use private ID documents**.

## Data/schema prerequisite

The source includes `User.primarySkill` and `User.interests`, and the separately reviewed SQL at `backend-readiness/account-preferences/20261101180000_account_discovery_preferences.sql`. Hustle's frozen **41-migration restore inventory must remain unchanged**. This candidate SQL was used only in ephemeral GitHub-Runner localhost PostgreSQL acceptance checks and **has not been applied to any hosted DB**. Review and apply only to an approved isolated child DB before deploying a matching Prisma-generated API. The Worker fails closed when an older backend ignores fields.

## QA gate

- Exact PR-head GitHub Actions: V1 UI Preview Auth Bridge; Foundation CI; disposable Connected API; isolated migration preflight, recovery contract, payment/MONIFlow sandbox (no real money), Adaptive and Expo auth smoke.
- iPhone Safari and Waydroid test: invited signup, wrong password, guest, new name, reserved username, suggested available username, taken username, photo skip / photo upload if R2 configured, skill, 2+ interests, area search, manual location denial, save, refresh, login restoration, edit, logout.
- Never interpret a source merge as a public Worker deployment. Verify exact Worker commit and isolated API revision first.
- No production schema changes, production login, finance ledger, escrow release, payouts or provider authorizations as part of this PR.

## Known release blockers

Authenticated device testing requires an isolated API reachable with valid staging auth sessions, reviewed preferences schema in that isolated DB, and Cloudflare Worker deploy to the founder-approved URL. Optional photo upload additionally needs the R2 test binding. Social OAuth and password-reset **remain intentionally disabled** until their distinct secure-provider setups exist.
