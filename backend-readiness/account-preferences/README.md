# User discovery preferences — reviewed candidate, not deployed

This change is part of the approved Cloudflare V1 onboarding milestone.

## Source of truth

- `User.primarySkill`: optional, **exactly one** chosen skill. Not proof of identity, competence, certification or approved HUSTLER status.
- `User.interests`: independent user-selected discovery topics, 0–10 distinct values. Not stored in the professional services taxonomy and not a substitute for verification.
- `User.location`: existing optional **general area label** chosen by the user. No precise GPS coordinates, street address, movement history or permission state is sent to the API.

`apps/api/prisma/schema.prisma`, `apps/api/src/auth/auth.service.ts`, and the first-party Cloudflare Worker implement these account fields. The interactive selectors live in `ui-preview/dist`, preserving the approved V1 design.

## Migration control and recovery baseline

The existing recovery tooling strictly enforces **41 reviewed Prisma migrations**. Do not add this candidate to `apps/api/prisma/migrations/`, run `prisma migrate deploy` with an unreviewed ledger change, or update the backup/restore expected inventory.

`20261101180000_account_discovery_preferences.sql` is a **candidate** additive SQL file (two nullable/defaulted columns). It has not been applied anywhere.

After founder approval, evaluate the recovery inventory and choose a separately approved migration path for the isolated, disposable child database before activating this source in any hosted backend. A Prisma client generated from the new model must **never** run against an unmigrated database. The production schema, parent Neon branch, backup archives, payment ledger and escrow remain unchanged.

## Acceptance gate

- Exact-head source tests must PASS: UI selector, catalog, rendering, location consent, auth bridge, API bounds, and TypeScript.
- Disposable PG17 migration test must verify old User rows, one optional skill, 0–10 interests, and rollback without touching a real database. Not completed until its CI evidence is recorded.
- Hosted isolated service may be promoted only after a reviewed schema change in that exact isolated DB and the API + Cloudflare Worker are deployed together.
- Founder device QA: select one skill, multiple interests, area by search or explicit GPS choice; confirm choice survives login, refresh and edits; reject malformed data and duplicate interests; deny uninvited accounts. Leave browsing, bookings and finance in demo mode until later milestones.

**Status: source work and automated tests only. No live deployment or database migration.**
