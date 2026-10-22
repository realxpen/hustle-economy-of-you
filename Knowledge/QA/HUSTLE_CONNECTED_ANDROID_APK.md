# Hustle connected Android internal APK — cloud delivery gate
Date: 2026-10-22
Status: Source change prepared; cloud Gradle build, APK artifact and hosted authentication are **not yet accepted**.

## Preserve completed device work
The previous offline Expo `demo` APK already passed owner-reported physical Android 7/7 tests on October 21 (see `HUSTLE_UX004_A14_INTEGRATION_ACCEPTANCE.md`). Do not reopen that accepted work. A demo is fictional and intentionally disconnected; it is **not** a successful live account test.

## New deliverable
The existing free GitHub native Gradle diagnostic builds a standalone **internal connected preview** via the already established Expo SDK54 prebuild + `:app:assembleRelease` path, and now preserves its output as a GitHub Actions artifact. It uses no Expo/EAS build credits, Expo token, production secrets, Play Store signing credentials, customer databases or payment provider integration.

- Build target: Android `com.hustle.economyofyou.preview`, `hustle-preview` scheme, `APP_VARIANT=preview`.
- Auth: the **real Better Auth client** with SecureStore, selected only for `isolated-staging`.
- API: exactly `https://hustle-isolated-staging-api.vercel.app/api/v1`, Auth `/api/auth`.
- Demo: disabled. Messages: enabled from approved staging feature flag. Booking writes, finance providers: disabled.
- Source guard, native autolinking, TypeScript, existing mobile source contracts, React-singleton check and Android Metro export run **before** native compilation.
- Verify release APK ZIP integrity, DEX and embedded JS bundle. Upload `hustle-connected-staging-internal.apk`, SHA256SUMS and build metadata as a short-retention GitHub artifact.
- The prebuilt internal release uses the generated Android template's **debug signing**, never a Play Store upload or production release.

## Delivery / test path
1. Review this PR's cloud `Hustle Android Native Gradle Diagnostic (free CI)`, `Hustle Mobile Cloud CI` and `Hustle Foundation CI` checks.
2. If green, the latest PR job's `hustle-connected-staging-apk-<commit>` artifact is available under that GitHub Actions run. After owner review/merge, the `main` push builds the same artifact for the merged revision.
3. Download the artifact ZIP from the GitHub Actions run and extract the APK. Installing the APK (Android's explicit sideload consent) and using a real phone are physical acceptance tasks; CI does not pretend to perform them.
4. On a genuine phone: launch, view isolated invited-email sign-in, register an allowlisted disposable account, sign out, relaunch, sign in, reopen app and verify persistence/session denial. After authentication, exercise real feed, Explore/service, enquiry messaging and denied/disabled booking/payment actions. No production account or money.
5. **Blocked until hosted API works**: the current isolated Vercel deployment is an older PR #190 commit returning `API_BOOTSTRAP_FAILED`; PR #193 merged and CI passed but was not deployed because of Vercel daily quota. Server secret validity and restricted child-only LOGIN roles remain unverified; login must not be reported working.

## Definition of done
- PR exact-head CI and Android Gradle job successful, and APK downloadable: **build acceptance**.
- Successful installation and launch on a physical Android device: **device startup acceptance**.
- Password signup/signin, auth reload, server session validation, signout revocation and real supported API journeys on the **correct restricted staging child**: **connected end-to-end acceptance**.
- Missing external credentials or failed hosted readiness are blockers, not test PASS. Don't broaden privileges, use production as staging, alter finance, or skip manual merge/release gates.
