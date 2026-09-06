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
- `docker-compose.yml` provides local PostgreSQL + Redis for development.
- Media flows through an object-storage adapter boundary.
- Auth uses an explicit provider port; Phase 2 owns actual auth flows/provider activation.
- Analytics begins with a canonical event envelope and `POST /api/v1/events` persistence path.
- Structured logging and normalized errors exist before feature work.
- Root `vercel.json` builds the web workspace for UI/UX previews.

## Phase 1 gate
Validate:
- Mobile → API → Database
- Web → API
- Admin → API
- CI builds/typechecks the foundation
- Web has a working Vercel preview

The code-side foundation can be complete before hosted external providers are selected, but the gate is not fully satisfied until actual development infrastructure is connected and the end-to-end paths are exercised.
