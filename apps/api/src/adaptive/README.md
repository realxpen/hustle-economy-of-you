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
- Owner-only prepare-canonical creates exactly one private canonical Service draft for appointment or item workflows. It reuses the existing Hustler profile and BookingScheduleService; a PostgreSQL row lock makes repeat requests idempotent. No publishing, booking, notification, charges or settlement.
- The existing BookingScheduleService already enforces capacity and atomic acceptance. Appointment drafts start with NO opening hours (closed). Staff declarations require verification and actual scheduling before publication.
- Editing adaptive draft settings does not update a linked canonical Service. Manage actual availability in Hustler Studio, with its existing publishing gates.


## Routes
All require Bearer Auth and feature flag. Base /api/v1/adaptive:
- GET /blueprints, GET /workspaces, POST /personal, POST /workspaces
- GET /invitations, POST /invitations/:memberId/accept, POST /invitations/:memberId/decline
- GET /workspaces/:workspaceId/members, POST /workspaces/:workspaceId/invitations
- POST /workspaces/:workspaceId/members/:memberId/revoke
- GET /workspaces/:workspaceId/services, POST /workspaces/:workspaceId/services
- PATCH /workspaces/:workspaceId/services/:draftId (expectedRevision); stale edits receive 409
- POST /workspaces/:workspaceId/services/:draftId/prepare-canonical (owner + active Hustler only)
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

Verified individual staff rostering, automatically syncing adaptive draft edits, and adaptive service publishing and economic pricing, order/payment/escrow writes, customer outreach, delivery logistics, AI matching, push notifications and evidence verification are not part of this safe skeleton. Existing Booking/Order APIs remain authoritative.

No production DB, payments, deployment or merge is changed by this branch.

## Workforce / verified availability milestone (PR after #300)

The private, workspace-scoped Staff Roster records named team members with or without accounts. Offline staff do not receive authentication, permissions, payouts or agent delegation.

Authorized owners and explicitly consented `schedule.manage` members can manage shifts, off-days, active status and a shared workstation capacity. Saving schedules obtains the **same PostgreSQL transaction-scoped advisory lock** used by the canonical Booking acceptance path, preventing concurrent writes to capacity.

An **explicitly enabled** roster limits appointment slots to the minimum of the existing published Service capacity, active staff who cover the entire requested appointment (including buffer), and usable chairs/stations. Workers on leave or inactive no longer contribute to new openings; accepted reservations are never automatically cancelled and the API reports how many upcoming commitments should be reviewed.

No roster exists by default and `rosterEnabled=false` on existing businesses, so all legacy services retain their current FlowTime behavior. New canonical service drafts also remain closed until the professional configures actual business hours.

This is a **source-aligned schema and feature-flagged implementation**; the new roster tables and station fields are added only to the UNAPPLIED migration proposal. CI runs the pure roster rules and a disposable PG17 booking-capacity integration. Production data, deployment, financial settlement, messaging and physical staff verification are untouched.

Current limitations: roster shifts are same-day (overnight shifts require a future tested contract), fixed-quantity appointments only (not yet named worker assignment), and time-off entry is expressed in Africa/Lagos local calendar days. Staff changes raise a review warning for existing reservations; they do not reassign an accepted booking or auto-notify clients.
