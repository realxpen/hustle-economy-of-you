# Hustle — First connected Android device readiness (isolated staging)

Date: 2026-10-22. Scope: nonproduction React Native + Expo internal APK and disposable Neon child only.

## Established delivery
- PR #197 was merged into main; its verified GitHub native build is [39821156958](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39821156958), with the `hustle-connected-staging-android` artifact including `Hustle-Staging.apk`. Its published APK digest is `dfa7fdff50ba9bb591d9aa38e713cdfabb291e569c2cd099f31907b7e7d7c085`.
- That build is Android arm64, *internal-test signed*. The prior fictional offline demo passed owner-reported phone checks; it is not the real identity test.
- Hosted isolated API health, disposable invited registration, password sign-in, account sync, bearer validation, revocation and cleanup passed in the verified PR #197 staging report. Neither a device nor the current installed APK has passed the same journey.
- Existing PR #196's alternative Android packaging is superseded by merged #197; do not merge the older duplicate into main.

## Additional mobile readiness safeguards
- A selected Expo staging provider now requires **both** `APP_VARIANT=preview` **and** `EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE=isolated-staging`; wrong variant/scope, offline demo, wrong exact API/Auth host or enabled booking requests fail closed before client creation.
- The sign-in screen requests **anonymous GET-only** `/api/v1/health`, with cookies omitted, no bearer token, and a bounded timeout. Only the exact isolated API response with a connected database/auth dependency is marked `Test server reachable`. This *does not* prove an account, login service, or invitation is valid.
- An unavailable API shows a `Retry connection` control, without asking the founder for logs or terminal use.
- After signup/signin, the client requires an actual verified Better Auth session/user response before displaying the authenticated application.
- Credential-free unit regressions cover allowed/rejected environment combinations, scope/provider mismatch, no-token health requests, bad/redirected/degraded/HTML responses, timeout, and auth-session UI guard. Android native and Mobile CI run the regressions. No real signup/credential/financial API calls in these tests.

## Physical Android test when the founder has the phone
1. Open the successful latest **reviewed and approved** connected staging APK artifact; download the ZIP and extract `Hustle-Staging.apk`, verify artifact source/build info. The GitHub artifact is retained for seven days, not permanently.
2. Install the APK on the Android phone after Android's normal sideload consent, open **Hustle Staging** (not the old offline demo), and confirm the form displays the read-only API connection state. The existing #197 APK predates the new connection display; it still supports native login testing.
3. Use **only an allowed disposable test email**, not production/real account passwords. Create the test account using a new private password (never send it through chat). If it already exists, sign in.
4. Confirm the native app opens Home / Explore / Inbox / You. Check real API empty/error states truthfully, use search, then close/reopen to verify native session restoration.
5. Sign out; verify the protected app stops displaying private data and a fresh session is required. If an invited test account or published test offer/conversation is unavailable, mark that journey *not tested* rather than inventing content.
6. Report a screenshot of screen/error **without passwords, tokens, private conversation data or email address**. The technical agent handles follow-up debugging.

## Not accepted by automated CI
Physical Android installation/launch, Android SecureStore cookie persistence, invitation provisioning, fully populated discovery, live peer messaging, booking/payment, and production readiness remain separate.
