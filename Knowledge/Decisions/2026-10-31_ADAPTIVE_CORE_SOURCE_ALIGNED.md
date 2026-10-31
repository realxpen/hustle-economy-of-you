# Decision: Adaptive Core v1 uses Hustle's existing CUID identity and Prisma models

Date: 2026-10-31
Status: Proposed on feat/adaptive-core-backend-v1; requires review
Scope: Core Skeleton + Backend Integration milestone

## Context

Hustle already has a modular NestJS backend, PostgreSQL managed with Prisma, a single User with authSubject adapter, progressive Client/Hustler/Agent capabilities, distinct Booking and Order models, payment/escrow ledgers, and an AgentRelationship consent framework. Existing child staging and production migration controls cannot be bypassed.

The standalone UI preview demonstrated a broad adaptive economy and exploratory backend-readiness SQL. That SQL assumed Supabase auth.users UUIDs and a separate adaptive schema; it was never applied and is incompatible with the actual Prisma CUID domain.

## Decision

1. Keep one authenticated User, preserve current capability review. A personal workspace and any number of business/team/agency workspaces belong to a User; workspaces do not create new user identities.
2. Add workspace memberships with owner-only invitations, direct recipient acceptance, and allowlisted scopes checked on every API call. Financial, identity, owner transfer and escrow permissions remain nondelegable.
3. Define nine immutable blueprint versions. Initially these power PRIVATE service drafts only. Published real Service records continue their existing Hustler verification/moderation flow.
4. Add private adaptive Work drafts and event history. Existing Booking and Order tables remain financially and operationally authoritative; the first Work Hub is an authenticated aggregation, not a rewrite.
5. Use the real Prisma extension and additive migration proposal, not the exploratory UUID schema.
6. Fail closed by default with HUSTLE_ADAPTIVE_CORE_ENABLED=false. Isolated staging additionally keeps its existing route allowlist, so this PR cannot silently activate new APIs.
7. Build the Next.js My Economy surface on authenticatedFetch and show a truthful gated state until actual backend activation; no local mock persistence as a fallback.

## Consequences and staged follow-up

This supports multiple businesses and explicit delegation while protecting identity, payment history and existing transactions. It avoids schema drift and permits incremental integration into real mobile/web journeys.

A later milestone can connect business-owned Service listings, atomic resources, signed quotes and work fulfilment through the existing Booking/Order APIs, plus release-authorized payments and notifications. It MUST include cross-tenant isolation, concurrent booking and revocation acceptance tests in a disposable DB before activation.

## Validation and review gates

- Prisma generation, TypeScript typecheck, monorepo CI and 12 targeted security structural tests.
- Isolated Postgres migration and constrained-runtime permission test.
- Verify existing migration history and Vercel isolated staging route controls.
- No production DB migration, parent-branch merge or payments without founder approval.
