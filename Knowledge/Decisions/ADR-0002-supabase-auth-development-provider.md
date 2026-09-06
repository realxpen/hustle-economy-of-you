# ADR-0002 — Supabase Auth as Phase 2 Development Provider

Status: Active for development
Date: 2026-09-06

## Decision
Use Supabase Auth for Hustle Phase 2 development behind the existing `AuthPort` boundary.

## Why
- Supports web and React Native/Expo authentication.
- Keeps provider identity separate from Hustle's own capability/permission model.
- Works with the existing PostgreSQL-centered architecture while allowing the operational database to remain authoritative for capabilities.
- Enables email/password, email verification, password recovery and phone OTP without creating separate identity systems.

## Guardrails
- Never reuse another product's Supabase project.
- Never expose secret/service-role keys to web or mobile.
- Use only publishable keys in public clients.
- Never authorize from editable user metadata.
- API validates the provider token independently.
- Capability authority remains in `UserCapability`.
- Replacing Supabase later should not require changing Hustle's account model.

## Consequence
A dedicated Hustle Supabase project must be provisioned before the phase can be exercised end-to-end.
