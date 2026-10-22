# ADR-0069 — Free, isolated Hustle staging database, identity and deployment boundaries

**Status:** Accepted staging-resource direction by owner; implementation **PARTIAL**, no connected staging API or Android acceptance  
**Date:** 2026-10-22  
**Scope:** Nonproduction infrastructure only; **production remains Supabase Auth/PostgreSQL, without code or data migration**.

## Context

The owner approved a **separate free test environment** and instructed the agent to avoid their terminal and never modify production accounts or payment systems. Connected API contract PRs #180 and #182 are merged and fully green, but they run only on temporary localhost GitHub PostgreSQL with test-injected bearer identities.

Supabase already has two active Free projects, so a third isolated Free Supabase Auth+DB project is unavailable. Supabase Preview Branching is not a zero-cost substitute. Vercel Hobby build-rate-limit failures on unrelated mobile PRs are tracked in issue #176.

Neon offers managed Better Auth and PostgreSQL on Free. This makes it possible to maintain independent test identities and rows without changing the existing Supabase production app. **There is no automatic compatibility between Supabase and Neon authentication session tokens.**

## Decision

1. Provision a distinct Neon Free project `summer-sound-54525078` called `hustle-isolated-staging` (London PG17), with one `staging` branch and dedicated `hustle_staging` database. Cap auto-scaling at 0.25 CU. Existing database projects remain intact.
2. Provision Neon Managed Better Auth only on that project branch. A read-only SQL check confirms the `neon_auth.user` table exists and the public Hustle `User` table does not; application migrations have NOT been run.
3. Preserve production `SupabaseAuthService` unchanged. Before staging deploy, introduce a **separate fail-closed auth adapter**, validating short-lived Neon JWTs against this branch's exact managed JWKS/issuer and expiration. It must not accept unsigned tokens, credentials from production Supabase, arbitrary JWKS URLs, impersonated user IDs or fallback bearer tokens. Map verified `sub` into the existing `AuthIdentity`/Client capability model. No role switching.
4. Future staging API process must explicitly call `validateIsolatedStagingConfiguration` before opening connections, and refuse foreign `DATABASE_URL`, issuer, financial provider variables and any enabled booking writes. Current pure guard source is a preparation artifact **not yet wired into the API**; source tests do not replace runtime verification.
5. Neon Functions deployment was **attempted but refused** (`HTTP 404 platform functions not available for this project`). The health handler is only a source fixture, not hosted.
6. Create a separate, unlinked **Vercel test API project** `hustle-isolated-staging-api` (`prj_1zba0YSCmWxYxkKQApt8JGAgVTHW`), with NestJS workspace root `apps/api`, auto Git deployment OFF and no env secrets. It has **no deployment**, avoiding unintended traffic, public API exposure, or more quota use until auth/schema/gates are prepared.
7. Do not create real accounts or copy production balances, files, auth users or provider configurations into staging. Before real login, restrict or verify test registration, then use disposable consenting Client/ACTIVE Hustler accounts. Keep finance and booking writes off. Actual staging migration/deployment/device test require their own reviewed engineering gates.

## Explicit alternatives rejected

- Reuse existing live Hustle Supabase project as staging or pause/modify other apps to free a slot.
- Create a paid Supabase project/branch or enable Vercel paid tier without a separate owner decision.
- Wire Neon auth into the live production app, silently replace Supabase tokens, or run unverified mixed-mode session fallbacks.
- Create an insecure mock-token bypass in a public staging server. The previously verified synthetic tokens remain confined to an isolated GitHub runner.
- Claim a public readiness endpoint, authenticated application or hardware approval based on source tests alone.
- Trigger production marketplace, finance, booking or real-user operations.

## Acceptance and rollout

A nonproduction hosting project is merely reserved. Its actual deployment needs the completed fail-closed staging auth adapter, real reviewed Prisma migrations on the EMPTY stage DB, staged-only service fixtures, appropriate privacy/verification settings, a separate real staging API endpoint, and actual signed-in Android acceptance. Expo build credits and production changes stay owner gated. Vercel Hobby may be used only for permitted noncommercial internal test activity, not production marketplace commerce.

See `Knowledge/QA/HUSTLE_NEON_FREE_STAGING_READINESS.md` and issues #179/#176. The first staging source PR adds only a pure guard and a provider-neutral health handler with no external requests or server credentials.
