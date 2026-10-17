# Hustle Expo EAS Cloud Preview — Acceptance Gate

**Scope:** Review branch `feat/mobile-eas-cloud-preview-gate`; integration PR #127 already merged.

## Prepared cloud assets
- `apps/mobile/app.config.js`: preview app branding and isolated package IDs, unchanged default app identity.
- `apps/mobile/eas.json`: preview Android APK, iOS simulator preview, and credential-free emulator/simulator E2E profiles.
- `.github/workflows/hustle-mobile-eas-preview.yml`: manual-only GitHub Actions trigger, explicit approval input, no store submit.
- `apps/mobile/.eas/workflows/hustle-e2e-android.yml` and `hustle-e2e-ios.yml`: build + Maestro test jobs, manually launched via GitHub.
- `apps/mobile/.maestro/auth-smoke.yml`: nonauthenticated identity/signin/signup navigation assertions. Does not assert a real signed-in journey.
- `apps/mobile/scripts/cloud-preview-config-gate.cjs`: source-only contract checks run by Mobile Cloud CI.

## One-time cloud connections required before launching a build
1. An owner-controlled Expo/EAS project exists for Hustle. Its project UUID is public but must correspond to the correct owner/project. The workflow does not create a new Expo project or auto-enroll payment plans.
2. GitHub **environment** `mobile-preview` is configured with `EXPO_TOKEN` as an environment **secret** (never paste token in chat) and `EXPO_PROJECT_ID` as an environment **variable**. Add environment approver protection if available.
3. In the Expo project's EAS environment named `preview`, configure `EXPO_PUBLIC_API_URL` to a working nonproduction Hustle API, `EXPO_PUBLIC_SUPABASE_URL` to nonproduction auth, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the matching publishable key, and optionally `EXPO_PUBLIC_PUBLIC_WEB_URL` to nonproduction web. For cloud config parity, also provide `EXPO_PROJECT_ID` in the EAS preview environment if requested by remote Expo config resolution.
4. First-time EAS signing/project credential provisioning may require a separate Expo owner action. The GitHub workflow does not invent or print credentials. iOS physical distribution additionally requires Apple signing; the configured `ios-simulator` and E2E iOS variants do not produce an iPhone-installable build.

## Cloud execution (no local setup)
From **GitHub > Actions > Hustle Mobile EAS Preview (manual) > Run workflow**, select `main` once this PR is merged, choose `android`, `ios-simulator`, `e2e-android`, or `e2e-ios`, and explicitly enable the nonproduction approval input. The workflow checks the Expo connection and queues EAS work. View installable artifacts or test logs through the returned EAS dashboard link.

## Evidence required to mark milestone complete
- Green exact-head GitHub Foundation CI and Mobile Cloud CI, including `cloud-preview-config-gate.cjs`.
- EAS artifact successfully built for required platform(s), with build URL and target identifier recorded.
- EAS Maestro smoke pass for both Android emulator and iOS simulator, with linked cloud logs.
- Separate verified staging test accounts for Client and Hustler; authenticated session recovery, scroll/video lifecycle, comments/replies, save/follow, discovery, attached Service, truthful slots and rejection cases must be tested with nonproduction records.
- Booking POST remains disabled and no payment/escrow activity is conducted during smoke testing.
- Accessibility, small screens, Android Back, offline/slow networking and media lifecycle need explicit acceptance before release.

## Current limits
This PR provisions code and gated workflows only. It does **not** connect an Expo owner token, initialize an EAS project, perform cloud builds, issue developer credentials, run Maestro tests, test a device, or deploy production. Actual tests need explicit connected cloud project permission. Maestro EAS jobs are an alpha capability; failure to provision should be reported, not treated as an app defect.
