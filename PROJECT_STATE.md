# Hustle Project State

Updated: 2026-09-06

## Current AED capability
Build

## Current MVP phase
Phase 2 — Authentication + Unified Account System

## Phase 1 status
Code foundation validated in CI. External infrastructure activation remains partially open.

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

## Validation
Phase 2 code validation: PASS

Validated in GitHub Actions:
- web type-check + production build
- admin type-check + production build
- mobile type-check
- Prisma client generation
- API type-check + production build

Vercel:
- web project: deployment succeeds
- api project: deployment still fails on Vercel despite the NestJS production build succeeding in GitHub CI
- `apps/api/vercel.json` now explicitly declares the NestJS framework
- the connected Vercel integration is not authorized for the `swifnatechnologyltd` team scope, so its deployment logs cannot currently be inspected from this session

## External activation still required
- Provision a dedicated Hustle Supabase project. Existing MONIFlow/other projects must not be reused.
- Configure web/mobile/API publishable Supabase environment values.
- Connect a hosted Hustle development PostgreSQL database and run migrations.
- Configure Supabase Auth redirect URLs for local + Vercel preview domains.
- Configure an SMS provider inside Supabase before phone OTP can send real messages.
- Re-authenticate the Vercel integration to the `swifnatechnologyltd` team scope or inspect the API deployment logs there so the remaining deployment issue can be resolved.
- Exercise the real end-to-end identity loop.

## Phase 2 gate
A real new user must be able to:
`Register → verify → synchronize → receive CLIENT → complete profile → sign out → sign back in → retain the same Hustle identity and capability history.`

## Current rule
Do not begin Phase 3 until the Phase 2 operational identity loop is exercised successfully or the project owner explicitly waives that gate.

## Next phase after gate
Phase 3 — Hustler Application + Verification.
