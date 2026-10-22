# Hustle staged Neon identity boundary — A3.6

**Date:** 2026-10-22  
**Status:** Ready for *source and cryptographic* cloud validation; live Neon JWT exchange and deployed API verification remain **PENDING**.

## Knowledge and context

- Owner-approved Free isolated Neon project: `summer-sound-54525078`, database `hustle_staging`, London PG17. Managed Better Auth provisioned; **no** actual Hustle application migrations or account sync have run there.
- PR #183 merged into `main` with staging source isolation/health and Foundation checks green. The separate Vercel project `hustle-isolated-staging-api` exists but has no deployment or secrets.
- Production Nest AuthPort currently uses Supabase `auth.getUser(token)`; this production path and the existing mobile Supabase sign-in are intentionally unchanged by this slice.
- Neon Better Auth offers short-lived JWKS-verifiable JWTs for downstream services via its dedicated token flow. These are **not equivalent to Better Auth session cookies** or Supabase sessions. Documented default is EdDSA, about fifteen minutes, with issuer and audience usually the Auth base URL. These exact claims still require proof against a real disposable staging account before deployment.

## Specification

1. Add a `NeonStagingAuthService` that verifies an **EdDSA Ed25519** compact JWT against ONLY the pinned HTTPS JWKS for the isolated Neon Better Auth instance. Fetch JWKS with timeout, no redirects, bounded body, strict public-key shape, duplicate-kid rejection and short cache. Verify cryptographic signature, exact issuer and audience, subject, `iat`, `nbf`, `exp` and maximum 30-minute lifetime. No hardcoded real credentials or user data.
2. Only `HUSTLE_RUNTIME_SCOPE=isolated-staging` and exact **new** Neon issuer/JWKS, database host/name/TLS mode, project ID and disabled booking/payment flags permit the staging AuthPort. Any mismatch fails closed. Extra Supabase, Paystack, MONIFlow, Vercel or Expo credentials are rejected in isolated staging.
3. For production/default scope, the existing `SupabaseAuthService` remains the injected provider. Never attempt Neon if Supabase authentication fails and never attempt Supabase if a Neon staging bearer is invalid.
4. The runtime guard executes **before** `NestFactory.create`, meaning no Prisma module construction or provider integration occurs on a bad isolated DB/issuer configuration. The provider selection repeats the guard inside the auth module as a defense in depth.
5. Parsed optional email/phone claims are only treated as verified when explicitly boolean true in the verified JWT. Do not trust usernames, unverified email addresses or custom roles for capability elevation.
6. **No** direct API exposure, login endpoint changes, booking submission, transaction authority, database migration, EAS build, user invite or external deployment in this slice. The short-lived EdDSA verifier cannot verify opaque Better Auth session tokens.

## Implementation and automated checks

- `apps/api/src/auth/neon-staging-auth.service.ts` — real staging-only AuthPort verifier with crypto and a pinned public JWKS URL.
- `apps/api/src/auth/staging-auth-selection.ts` — explicit production/staging selection and isolated hostname, project, auth and commerce guards. It must remain consistent with the earlier `infra/neon/staging/stagingConfig.mjs` policy.
- `apps/api/src/auth/auth.module.ts` — one factory selection, no fallback on bad tokens, and no changed guards/controllers.
- `apps/api/src/main.ts` — fail closed **before** Nest/Prisma creation.
- `scripts/staging/neon-jwt-auth-contract.cjs` — executes actual TypeScript code with generated local Ed25519 keys. Valid token/claims, cache, wrong issuer/audience/subject/expiration, unsigned/symmetric/forged tokens, wrong JWKS/malicious key, production fallbacks, database host, and disabled payments are asserted.
- `.github/workflows/neon-staging-jwt-security.yml` executes the contract and actual NestJS TypeScript compiler. Existing Foundation CI and ephemeral API acceptance remain independent.

## Deferred real staging/runtime acceptance — NOT DONE

- [ ] Determine that the actual Neon Managed Auth `/token` API returns JWKS-verifiable tokens with the expected **exact issuer and audience**. Provider documentation can vary by configured issuer; do not weaken the verifier if claims differ: confirm server configuration and update pins with owner review.
- [ ] Apply actual reviewed Prisma schema/migrations to the fresh staging-only database, verify empty user/payment histories, protect credentials and isolate auth tables. This requires a separate migration-specific gate; **not performed**.
- [ ] Ensure staging registration is limited to consenting test users, then validate two disposable Client and ACTIVE Hustler sessions. No production user import or password copied.
- [ ] Deploy protected isolated NestJS API on the separate Vercel project only after the free deployment quota and environment isolation checks. Test wrong-issuer bearer 401 and verified Neon JWT 200 on actual host.
- [ ] Introduce a dedicated staging-only Expo mobile login adapter; keep production mobile on Supabase, avoid automatic fallback. Don't trigger Free EAS build without separate owner approval.
- [ ] Repeat real connected Discover → Hustler → service → GET slots → unsent enquiry on Android, including logout/revocation/expiry, enlarged text, TalkBack, slow network and wrong-tenant tokens.

**Safety:** This PR changes app boot/auth code but leaves production behavior on its previous Supabase path. Exact-head cryptographic+TypeScript+Foundation tests, peer review and explicit owner manual merge are required. No public API is claimed ready by these source tests.
