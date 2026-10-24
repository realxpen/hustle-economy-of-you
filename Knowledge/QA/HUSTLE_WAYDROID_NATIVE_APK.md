# Hustle — native Waydroid test build

Status: PR implementation; physical Waydroid acceptance not yet verified.

## Why this exists
The previously successful connected staging APK (PR #198, build 39839205425, source 186df64d6af832566b08d863ca27567c2a11d6e9) contains `lib/arm64-v8a` only. Typical Waydroid Linux installations run x86_64 Android and cannot install a native ARM64-only APK without a separate ARM translation layer. Avoid requiring the owner to modify Waydroid or install third-party emulation.

## Delivery
The existing free Android Native Gradle workflow builds two independently signed native APK artifacts from the same approved isolated staging source:
- `hustle-connected-staging-arm64-v8a` => `Hustle-Staging.apk` for ARM64 Android phones
- `hustle-connected-staging-x86_64` => `Hustle-Staging-Waydroid.apk` for x86_64 Waydroid

Both keep the package `com.hustle.economyofyou.preview.staging`, staging Better Auth and restricted child API, disabled demo/booking writes, and no EAS credits or production credentials. The packaging script checks the actual Android signing signature, package ID, native ABI from `aapt dump badging`, writes SHA256 and exact-source build information, and rejects a wrong ABI. Separate artifact names avoid races between GitHub matrix jobs.

## Waydroid smoke test
1. Download the successful `hustle-connected-staging-x86_64` artifact (ZIP) from the GitHub Actions run, extract `Hustle-Staging-Waydroid.apk`.
2. With Waydroid running, install with its normal APK installer if available, otherwise the Waydroid-supported user command `waydroid app install /absolute/path/to/Hustle-Staging-Waydroid.apk`. Do not use `sudo` or alter the Waydroid system image.
3. Launch Hustle Staging from the Waydroid apps menu. The app should display the real **Private Test** sign-in and test server status, not the fictional offline demo. Confirm status `Test server reachable`; retry if Waydroid network connectivity is unavailable.
4. Use only an **invited disposable test email**. Registration requires the server-only allowlist; do not paste or send passwords, tokens, or account cookies. Test sign-in, account initialization, Home, Explore, empty states, sign-out. Do not claim messaging or real search results work until suitable test providers/records exist.
5. Close/reopen the app and check session restoration and signout. Capture non-sensitive screenshot/error only.

Waydroid is an emulated container environment, **not physical Android phone acceptance**. Later compare on an Android handset. No real payments/booking/escrow or production accounts are permitted. Since internal APKs are debug signed, uninstall an old *same-package* installation before changing signing key if Android reports signature incompatibility; it will remove local test state.
