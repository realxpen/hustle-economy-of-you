# Hustle Expo EAS Cloud Preview — Free Plan Acceptance Gate

**Scope:** Review branch `feat/mobile-eas-cloud-preview-gate`; mobile integration PR #127 already merged.

## Cost boundary (Expo Free)
As of 2026-10-17 Expo Free advertises up to 15 Android and 15 iOS EAS builds each month and up to 60 EAS workflow minutes. The EAS-hosted Maestro `type: maestro` jobs are not included on Expo Free (source: https://expo.dev/pricing). This PR **does not provide or trigger paid Maestro testing**. Standard GitHub-hosted source checks are the automated free-tier validation; no real-device test has been completed.

## Prepared cloud assets
- `apps/mobile/app.config.js`: dedicated `Hustle Preview` identity with preview-only Android and iOS package identifiers.
- `apps/mobile/eas.json`: Android internal APK and iOS simulator preview build profiles; both force `EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=false`.
- `.github/workflows/hustle-mobile-eas-preview.yml`: manual-only GitHub Actions bridge to EAS cloud builds. Explicit approval input, no store submission, no Maestro job.
- `apps/mobile/scripts/cloud-preview-config-gate.cjs`: static safety contract executed on every Mobile Cloud CI PR.
- `apps/mobile/scripts/mobile-experience-contract.mjs`: content and booking source contracts already in Mobile Cloud CI.

## Cloud-only onboarding, once, without local development tools
1. The user created the Expo **Free** account `@xpen`. This branch now pins **preview-only** Expo owner to `xpen`; the default production identity is unchanged. No EAS project UUID is linked yet.
2. Create a private Expo access token at https://expo.dev/settings/access-tokens. On GitHub, open [Hustle repository Settings → Environments](https://github.com/realxpen/hustle-economy-of-you/settings/environments), create `mobile-preview`, and add the token under **Environment secrets** as `EXPO_TOKEN`. Do not paste it into ChatGPT, code or a commit.
3. **Completed:** The one-time GitHub linker succeeded; project verified at https://expo.dev/accounts/xpen/projects/hustle. The public project ID is pinned in the preview app config and GitHub preview workflow, so no `EXPO_PROJECT_ID` GitHub variable or secret is required. An existing environment secret with that name may remain unused; do not duplicate the public ID in secrets.
4. **Not started:** First nonproduction EAS Android build.
5. Configure Expo EAS `preview` environment with nonproduction `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set preview-only authentication and API credentials; don't attach the active production database. Booking writes stay off.
6. Only after these conditions and owner approval, trigger **GitHub → Actions → Hustle Mobile EAS Preview (manual)** and choose `android` or `ios-simulator`. EAS may request first-time signing credential setup. If it cannot run non-interactively, stop and resolve through the Expo cloud account.
7. Review Android APK or iOS simulator build artifacts and EAS dashboard logs. A successful cloud build is **not** proof of the full signed-in user journey.

## Quality gate before wider release
- Green latest-head Foundation CI and Mobile Cloud CI.
- App identity verification and actual EAS build result recorded (URL, target, outcome).
- Nonproduction account/session and content-to-booking acceptance on a real Android device or trusted remote testing environment, with authorization and explicit evidence.
- Verify video pause/unload, cursor loading, likes/comments/saves/follows, external share, attached Service, timezone-accurate slots, offline/slow network and error/retry behavior.
- Confirm booking POST, payments, escrow and merchant/provider operations remain disabled during preview.
- No iPhone App Store distribution or automatic store submissions.

## Current limitation
The owner linked @xpen/hustle successfully on 2026-10-17 (workflow run 39055672347). Public EAS project ID is `b52b03ef-37f1-4bdf-ab42-5c80e5988ec4`. No Expo build has started yet and no preview build or real-device test has run. A separate cloud project authentication step is required; the assistant cannot silently provision an Expo account or store its token. Paid EAS Maestro jobs are deliberately excluded from this free-plan milestone.
