# Isolated Expo authentication acceptance

Owner approved ADR-0070 on 2026-10-22. Better Auth and its official Expo plugins are pinned to 1.7.12 on server and client. SDK54 dependencies remain on their compatible versions; no Expo upgrade.

The application AuthPort checks opaque sessions against Better Auth's database on each request. It never accepts the old managed JWT as a fallback. Native cookies are stored by the official Expo client in SecureStore; cached session data is disabled. API identity exposes the verified subject/email state only and the application retains its existing Client baseline.

`apps/api/staging-auth/prisma` is a separate Prisma schema/migration history targeting `hustle_auth`, not `public` or `neon_auth`. Its generated client is built during install and build. No production migration is added. The server handler is mounted before Nest body parsing; the rest of the API retains raw-body handling.

`HUSTLE_AUTH_PROVIDER=expo-better-auth` is accepted only for the existing isolated project, exact reserved HTTPS API host, explicit disabled finance/booking flags, and schema-pinned database URLs. It requires a new private server session secret and a nonempty server-only test-email allowlist. Uninvited registration is refused. New test emails are never assigned admin or Hustler privileges. Production defaults to the unchanged Supabase implementation.

The mobile adapter is opt-in with `EXPO_PUBLIC_HUSTLE_AUTH_PROVIDER=expo-better-auth` and `EXPO_PUBLIC_HUSTLE_RUNTIME_SCOPE=isolated-staging`, matching exact API/Auth URLs. The preview scheme is `hustle-preview`; production stays `hustle`. Offline demo remains independent. Do not enable hosted preview settings until hosted runtime acceptance passes.

## Evidence and remaining work

Local Nest build, API/mobile TypeScript, staging environment/adversarial legacy-JWT contracts and connected Android Metro export passed. New CI executes actual Nest HTTP password sign-up/sign-in, PostgreSQL persistence/password hashing, registration allowlist, Expo origin validation, cookie restoration, Bearer AuthPort, forged token rejection, sign-out revocation and expiry on disposable PostgreSQL 17. Inspect its actual result before claiming database-backed acceptance.

This workspace has no usable Docker daemon or non-root PostgreSQL runtime. Database integration runs on the GitHub service container, without owner terminal work or private credentials. Hosted Neon migrations, API deployment, real native SecureStore/session restoration and physical-device UX are not established by compilation. Existing saved-backup acceptance is already complete and is not repeated here.

Full app staging additionally needs the reviewed application migration/bootstrap plan for Supabase-specific historical Storage SQL. Do not run the disposable payment-sandbox bootstrap on hosted Neon. Uploaded-file services, SMTP/password recovery, OAuth/MFA and production cutover are outside this auth acceptance.
