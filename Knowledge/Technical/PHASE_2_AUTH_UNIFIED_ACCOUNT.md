# Phase 2 — Authentication + Unified Account System

## Goal
Create Hustle's identity foundation without introducing account types or role switching.

## Binding flow
`Sign up / sign in → verify contact → sync provider identity → create Hustle account → enable CLIENT → complete profile`

Every new person gets one Hustle account. `CLIENT` is automatically active. `HUSTLER` and `AGENT` are future additive capabilities and remain locked until their approved application phases.

## Development auth provider
Supabase Auth is the Phase 2 development provider behind an adapter boundary. Web uses current Supabase SSR/browser primitives; mobile uses Supabase JS with React Native session persistence; the API independently validates bearer access tokens before trusting identity.

Authorization never uses editable Supabase `user_metadata`. Hustle capability authority lives in the operational database in `UserCapability`.

## API
- `POST /api/v1/auth/sync` — synchronize verified provider identity and ensure CLIENT capability.
- `GET /api/v1/auth/me` — current unified account.
- `PATCH /api/v1/auth/profile` — profile/onboarding fields.

## Data model
- `User` owns the stable Hustle identity.
- `authSubject` links to the external auth provider identity.
- `UserCapability` is additive and status-aware.
- No role/mode field exists on `User`.

## Experience
Web preview surfaces:
- `/auth`
- `/auth/update-password`
- `/onboarding`
- `/account`

The experience intentionally reinforces: `One account. One reputation. No role switching.`

## Gate
Phase 2 is code-complete when web/mobile/API compile and the database migration is valid. Phase 2 is operationally complete only after a dedicated Hustle Supabase project is connected and a real new user can authenticate, synchronize, receive CLIENT, finish onboarding, sign out and return with the same account.
