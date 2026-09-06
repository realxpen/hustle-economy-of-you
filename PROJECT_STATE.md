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
- Prisma Phase 2 migration.

## External activation still required
- Provision a dedicated Hustle Supabase project. Existing MONIFlow/other projects must not be reused.
- Configure web/mobile/API publishable Supabase environment values.
- Connect a hosted Hustle development PostgreSQL database and run migrations.
- Configure Supabase Auth redirect URLs for local + Vercel preview domains.
- Configure an SMS provider inside Supabase before phone OTP can send real messages.
- Exercise the real end-to-end identity loop.

## Phase 2 gate
A real new user must be able to:
`Register → verify → synchronize → receive CLIENT → complete profile → sign out → sign back in → retain the same Hustle identity and capability history.`

## Next phase after gate
Phase 3 — Hustler Application + Verification.
