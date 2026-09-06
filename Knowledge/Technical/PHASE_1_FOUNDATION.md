# Phase 1 — Technical Foundation

## Goal
Create the technical skeleton without prematurely building marketplace features.

## Applications
- `apps/mobile`: React Native + Expo client.
- `apps/web`: public/client web surface and current Vercel UI/UX preview target.
- `apps/api`: NestJS modular monolith and API boundary.
- `apps/admin`: internal operations shell.

## Shared packages
- `packages/ui`
- `packages/types`
- `packages/validation`
- `packages/config`
- `packages/utilities`

## Data and infrastructure
- PostgreSQL is the operational system of record.
- Prisma owns schema/migrations initially.
- Redis is available for caching/ephemeral workloads when required.
- Media flows through an object-storage abstraction.
- Auth uses a provider boundary; Phase 2 owns actual auth flows.
- Analytics begins with a canonical event envelope.
- Structured logging and normalized errors exist before feature work.

## Phase 1 gate
Validate:
- Mobile → API → Database
- Web → API
- Admin → API
- CI builds/typechecks the foundation
- Web has a working Vercel preview
