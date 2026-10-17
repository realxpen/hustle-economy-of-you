# Decision: Cloud-only EAS mobile preview gate

**Date:** 2026-10-17
**Context:** Owner confirmed Hustle engineering happens in connected cloud services only; PR #127 mobile feed integration is merged and reviewed.

## Decision
Treat EAS Build as the opt-in free-tier preview plane for the existing `apps/mobile` Expo app and GitHub Actions as the free source-validation plane. Keep GitHub Actions source checks separate from paid, credentialed Expo build jobs. No automatic build or release is started by merging code.

## Safety boundaries
- `APP_VARIANT=preview` sets separate `com.hustle.economyofyou.preview` iOS/Android identifiers and `Hustle Preview` name. Default variant preserves current app identity.
- Build profile `preview` produces a test-installable Android APK; `ios-simulator` is for hosted iOS simulation, **not** a physical iPhone distribution package.
- Hosted EAS Maestro jobs are excluded because Expo Free does not include them. Device acceptance remains separately gated; no free hosted device capability is claimed.
- Preview and E2E profiles force `EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS=false`. No payments, provider rails, checkout or real escrow activated.
- Nonproduction auth/API environment is essential. Do not point preview at production Supabase/database or customer records.
- Expo Free offers a limited monthly EAS build quota (currently 15 Android and 15 iOS). The GitHub workflow is manual-only, requires explicit `approved_nonproduction_build=true` and GitHub environment `mobile-preview` and never starts paid testing or store submission.
- Credentials never enter tracked files. Expo token in GitHub environment secret; public Expo project UUID in GitHub environment variable. EAS preview env holds app runtime URLs and publishable auth key.
- The owner must authorize Expo project access and any billing. Missing Expo project/credentials block build, not bypassed.

## Options considered
- Local builds: rejected by cloud-only owner preference.
- Automatic builds on every push: rejected, to avoid credit spend and unintended rollouts.
- Direct production release: rejected; testing, staging auth acceptance and finance gates are not complete.

## Follow-up
After owner review/merge, connect the new Expo account and a disposable/staging-only backend, trigger the **manual** Free-plan cloud preview from GitHub Actions, review the EAS build artifact and separately plan authenticated device testing.
