# Hustle Project State

Updated: 2026-09-06

## Current AED capability
Build

## Current MVP phase
Phase 2 — Authentication + Unified Account System

## Phase 1 status
Code foundation validated in CI. Hosted PostgreSQL is now active through the dedicated Hustle Supabase project.

## Phase 2 decisions now active
- One provider identity maps to one Hustle `User`.
- Every synchronized user receives `CLIENT` automatically.
- `HUSTLER` and `AGENT` remain additive future capabilities.
- No role switcher and no account-type field.
- Supabase Auth is the development provider behind `AuthPort`.
- Hustle's database, not provider metadata, is authoritative for capabilities.

## Phase 2 implementation
- Web email/password authentication flow.
- Web email verification callback.
- Web password recovery/update flow.
- Web phone OTP flow.
- Expo email/password session flow.
- API bearer-token verification through Supabase.
- Provider identity → Hustle account synchronization.
- Automatic Client capability.
- Unified profile onboarding.
- Capability guard primitive for future protected actions.
- Account screen showing additive capability state.
- Prisma Phase 2 migration with RLS enabled on operational public tables.
- Locked Supabase dependency graph committed and CI switched to `npm ci`.
- Repeatable `npm run phase2:gate` identity-loop checker added.

## Supabase activation
Dedicated project created and healthy:
- Project name: `hustle-economy of you`
- Project ref: `pfgarmyygybmhiiuopym`
- Region: `eu-west-1`
- API URL: `https://pfgarmyygybmhiiuopym.supabase.co`

Applied hosted migrations:
- `phase1_foundation`
- `phase2_unified_account`
- `api_database_role`

Hosted schema verified:
- `SystemEvent`
- `User`
- `UserCapability`
- `Capability`: CLIENT / HUSTLER / AGENT
- `CapabilityStatus`: ACTIVE / SUSPENDED / REVOKED

Security validation:
- RLS enabled on all operational public tables.
- API-only policies exist for the dedicated `hustle_api` database role.
- Supabase Security Advisor: 0 findings after policy activation.
- Browser/mobile anon and authenticated roles are intentionally not granted identity-table policies.

## Validation
Latest Phase 2 repository validation: PASS

Validated in GitHub Actions after Supabase activation changes:
- locked dependency install
- web type-check + production build
- admin type-check + production build
- mobile type-check
- Prisma client generation
- API type-check + production build

Supabase:
- hosted project healthy
- migrations applied
- live schema inspected
- generated database types match the expected Phase 2 model
- security advisor clean

Vercel:
- web project has previously deployed successfully
- latest API deployment attempt was blocked by the Vercel account build-rate/upgrade limit, not by a Hustle compile failure
- `apps/api/vercel.json` explicitly declares the NestJS framework
- the connected Vercel integration still exposes no usable `swifnatechnologyltd` team scope from this session

## Remaining Phase 2 activation
- Set a password/connection credential for the dedicated `hustle_api` Postgres role (the connected Supabase tool blocks credential mutation).
- Set API `DATABASE_URL` to Supabase Supavisor transaction mode (`6543`) for Vercel serverless runtime.
- Configure Vercel environment values for web/API; the connected Vercel tool currently cannot mutate/read the team scope.
- Configure Supabase Auth Site URL + redirect allow-list for local and Vercel URLs.
- Keep hosted email confirmation enabled; Supabase hosted projects enable confirmation by default.
- Configure an SMS provider only when real phone OTP testing is required.
- Exercise `npm run phase2:gate` with a real verified test identity.

## Phase 2 gate
A real new user must be able to:
`Register → verify → synchronize → receive CLIENT → complete profile → sign out → sign back in → retain the same Hustle identity and capability history.`

## Current rule
Do not begin Phase 3 until the Phase 2 operational identity loop is exercised successfully or the project owner explicitly waives that gate.

## Next phase after gate
Phase 3 — Hustler Application + Verification.
