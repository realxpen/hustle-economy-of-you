# Adaptive Core v1 — source-aligned implementation

Status: **Review only. Migration unapplied; runtime feature OFF.**

Hustle's actual API is a NestJS modular monolith with Prisma/PostgreSQL and an existing authentication adapter. The older backend-readiness/adaptive-v1/001_schema.sql document was only exploratory. It assumed UUID references to Supabase auth.users and a separate adaptive schema. **Do NOT execute that earlier SQL draft.** The real application uses User.id (CUID) and authenticated authSubject, with existing Booking, Order, UserCapability and AgentRelationship models.

This implementation adds six Prisma models and an UNAPPLIED SQL proposal under backend-readiness/adaptive-v1/prisma-migration-proposal.sql (not in the active migration ledger). They do not replace those existing tables or authentication.

## Implemented server slice
- Reuses existing AuthGuard, CurrentIdentity and PrismaService.
- Requires HUSTLE_ADAPTIVE_CORE_ENABLED=true, and only after an isolated DB migration. By default every new route returns 503.
- Existing isolated-staging route policy still blocks unapproved adaptive routes, even if the feature flag is enabled.
- One account can provision a personal workspace, create business/team/agency workspaces, switch contexts in the web UI, and see only its authorized memberships.
- Owner-controlled teammate invites require a separate authenticated recipient acceptance. AGENT invitees must already have approved Agent capability. Access is re-checked on each API request, and can be revoked.
- Only allowlisted services/work/schedule/messages/finance-summary permissions may be delegated; never withdrawal, escrow release, payout change or identity control.
- Nine versioned service blueprints with strict per-industry configuration and private draft edits. Appointment duration, declared staff/stations and capacity, paid/optional consultation credits, item intake/return and laundry ready notices, tailor sizing, group seats, event staffing, digital revisions and recurring frequency are supported as **draft policies only**. Publishing and real availability still use existing Hustler/Service/Booking systems.
- Private work drafts with optimistic version cancellation and an appended work-event row.
- Canonical Work Hub read projection over existing Booking and Order records, filtered by logged-in user, with no retroactive business attribution or duplicate booking/settlement records.
- Real Next.js /economy route and /account entry use existing authenticatedFetch. No fake data fallback.

## Routes
All require Bearer Auth and feature flag. Base /api/v1/adaptive:
- GET /blueprints, GET /workspaces, POST /personal, POST /workspaces
- GET /invitations, POST /invitations/:memberId/accept, POST /invitations/:memberId/decline
- GET /workspaces/:workspaceId/members, POST /workspaces/:workspaceId/invitations
- POST /workspaces/:workspaceId/members/:memberId/revoke
- GET /workspaces/:workspaceId/services, POST /workspaces/:workspaceId/services
- PATCH /workspaces/:workspaceId/services/:draftId (expectedRevision); stale edits receive 409
- POST /workspaces/:workspaceId/work-drafts
- PATCH /work-drafts/:workId/cancel with expectedVersion
- GET /work optionally scoped with workspaceId

## Validation gates
1. Run Prisma schema generation, API typecheck and web typecheck in CI.
2. Review migration against all existing Prisma migrations, then execute ONLY in a disposable PostgreSQL branch. Exercise privileges for the restricted runtime role.
3. Integration test owner, unrelated member, invitee pending/accepted/revoked, Agent scope, concurrent draft updates and client/hustler booking visibility.
4. Connect a disposable authenticated web/mobile identity. Confirm actual backend reads, not frontend fixtures.
5. Obtain founder authorization before any production schema change or deploy.

## Explicitly deferred
Draft capacity is a declaration, not validated worker availability. Consultation credits are configuration only; no credit is applied to a payment. Booking concurrency, payment, real notifications and staff roster activation are not yet connected.

Actual multi-staff resource booking, adaptive service publishing and economic pricing, order/payment/escrow writes, customer outreach, delivery logistics, AI matching, push notifications and evidence verification are not part of this safe skeleton. Existing Booking/Order APIs remain authoritative.

No production DB, payments, deployment or merge is changed by this branch.
