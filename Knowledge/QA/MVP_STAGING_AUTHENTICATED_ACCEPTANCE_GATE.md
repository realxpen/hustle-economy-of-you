# Hustle — Staging Authenticated Opportunity Acceptance

Date: 2026-10-14
Status: **One consolidated implementation PR. Live staging acceptance not yet executed; no accounts or provider credentials were supplied.**

## Baseline already confirmed

Owner approved Hustle PR #117, merged into `main` as `8f9eaf9e65e266c8b421d4b7fd1b40e202f67fd1`.
Merged product features: preserving safe destination through real login, email confirmation, onboarding, Service Booking and consultation. Prior local synthetic UI tests and isolated payment tests are not evidence of signed-in staging usability.

## Why this milestone exists

An apparent browser PASS is not evidence of usable authenticated Hustle. Public route shell / auth redirects, cached loading states, and synthetic account data cannot validate customer access. We need a fail-closed, **real staging** acceptance runner before a Lagos pilot, using separate Client and approved Hustler test sessions with real service data.

## What the implementation does

1. Owner supplies a **nonproduction HTTPS staging site**, explicit exact approved origin and its trusted project domain suffix. The host itself must be clearly named staging, qa, sandbox, stage or preview.
2. Owner supplies separate, disposable **Client** and **ACTIVE Hustler** Playwright `storageState` files, stored outside the source checkout with private file permissions, plus both usernames and a real published staging Service ID. There is no baked-in token, OTP, email or password.
3. Runner checks actual account pages through both isolated browser contexts, matching distinct account usernames and the Hustler's ACTIVE capability. Auth redirects and unresolved/loading-only account screens are INCOMPLETE, never PASS.
4. Client views the genuine published staging Service and validates the Service-context Message link. Then follows the real Book CTA to the booking request form and verifies required description gating and mobile viewport width **without submitting**.
5. Client and Hustler both visit the existing Bookings manager without switching account modes.
6. Result reports counts and generic check descriptions only, omitting names, IDs, session data, request URLs, tokens and screenshots. Errors return `INCOMPLETE` (exit 2); no fake success.
7. Foundation CI runs the safety policy tests **without staging credentials or any network calls**. The real staging runner is deliberately opt-in, separate from CI, so it never fabricates live acceptance.

## How to run, after staging is approved

Prepare two separate approved test users, sign in each in a separate Playwright context, save private `storageState` files **outside this repository**, and `chmod 600` both. Use only dummy staging data. Do not commit or paste state files, passwords, tokens or personal identity documents into PRs or chats.

Example configuration (replace placeholders locally, not in GitHub):

```bash
export HUSTLE_QA_CONFIRM=NONPRODUCTION_READ_ONLY
export HUSTLE_QA_WEB_ORIGIN=https://staging.hustle.example.com
export HUSTLE_QA_APPROVED_ORIGIN=https://staging.hustle.example.com
export HUSTLE_QA_ALLOWED_DOMAIN=hustle.example.com
export HUSTLE_QA_CLIENT_STATE=/outside-repo/client-storage-state.json
export HUSTLE_QA_HUSTLER_STATE=/outside-repo/hustler-storage-state.json
export HUSTLE_QA_CLIENT_HANDLE=client-test
export HUSTLE_QA_HUSTLER_HANDLE=hustler-test
export HUSTLE_QA_SERVICE_ID=published-test-service-id
export HUSTLE_QA_REPORT_PATH=/tmp/hustle-staging-qa.json

# Supply Playwright from an ephemeral local install when necessary:
# npm install --prefix /tmp/hustle-playwright --no-save playwright@1.56.1
# NODE_PATH=/tmp/hustle-playwright/node_modules node scripts/experience/staging-authenticated-acceptance.cjs
node scripts/experience/staging-authenticated-acceptance.cjs
```

Actual staging site names/IDs must be owner supplied. An unconfigured, unapproved or production-looking host must fail closed. Runner makes no Booking POST, Message POST, checkout, escrow release, refund, withdrawal, asset purchase or provider call on the user's behalf; no production activation.

## Milestone acceptance

- [ ] Exact-head Foundation CI validates safety policy and builds/browser smoke.
- [ ] Exact-head isolated Payment Sandbox and MONIFlow handshake pass.
- [ ] Actual owner-approved **staging** Client and Hustler sessions both pass the new read-only runner.
- [ ] Separate owner-driven sign-up/email confirmation, application/approval, content publish, Service publish, Message send and Booking creation/acceptance test under controlled staging test accounts is recorded.
- [ ] Chrome desktop/mobile and physical iOS Safari/Android device acceptance is recorded.
- [ ] Nigeria-specific merchant acquiring, regulated payments/custody/escrow/refund/payout remain NO-GO until independent provider/legal approval.

**Important:** Read-only staging acceptance is *not* equivalent to a full signed-in write-flow or real-finance acceptance. Never mark these pending gates complete based on source inspection, mocked browser responses or a green PR.

## Next AED handoff

The implementation completes staging validation *instrumentation* in Experience Architecture/Build. System Activation and Shadow require real nonproduction proof with approved test identities and environment. No new app roles or financial authority.
