# ADR-0070 — Native-compatible authentication in isolated staging

Status: Owner approved 2026-10-22; implementation and runtime acceptance in progress.

## Context and decision

ADR-0069 selected a separate Free Neon database and Managed Auth. The Managed service does not expose the Expo server plugin required by Better Auth's native integration. Generated JWT verification in PR #185 does not establish native sign-in compatibility.

Retain project `summer-sound-54525078`, database `hustle_staging` and the reserved isolated API host. Run pinned Better Auth with the official Expo server and client plugins on that API. Preserve the unused managed `neon_auth` schema. Use a separate `hustle_auth` schema with its own Prisma migrations and no production identities or sessions. This supersedes ADR-0069's managed authentication selection for staging only.

Use the official Bearer plugin and database-backed opaque sessions for the existing AuthPort. Every protected request resolves the session through Better Auth; no token-decoding trust, cross-provider fallback, or invented cookie transport. Expo owns native cookie storage in SecureStore. Sign-out revokes the server session. The native client revalidates stored sessions rather than treating a cache as authority.

Registration is limited to an explicit server-only list of disposable test emails. It confers no administrative or Hustler authority. Email/password only; email delivery, reset, OAuth and MFA are outside this initial internal test. No paid resources, production login changes, finance or booking activation.

## Acceptance

Test real password hashing and persistence, email allowlist, wrong password, trusted origins, session reload, protected AuthPort mapping, forged/expired/revoked tokens and sign-out on disposable PostgreSQL. Typecheck the Nest API and Expo client, export the native bundle, and run existing regression contracts. Hosted acceptance and physical-device sign-in must be reported separately from generated/local acceptance.

Sources: https://better-auth.com/docs/integrations/expo ; https://better-auth.com/docs/plugins/bearer ; https://better-auth.com/docs/adapters/prisma .
