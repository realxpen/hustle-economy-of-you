# Prisma history reconciliation — isolated rehearsal (October 16, 2026)

Status: **Proposed PR / isolated tests only**. Not an authorization to migrate the existing Supabase project.

## Context and confirmed evidence

Hustle uses the existing Supabase project `pfgarmyygybmhiiuopym`. At the October 16 read-only audit, `public._prisma_migrations` had **27 successful** entries through September 18; the separate Supabase ledger had **26** entries through October 9. These ledgers are independently managed and must not be forced to match.

Nine October migration SQL files have their schema objects already present on the hosted database, but their names have no successful Prisma ledger entries:
1. `20261007110000_phase18a_agent_capability_foundation`
2. `20261007114500_phase18b_agent_relationship_permissions`
3. `20261007123000_phase18b_relationship_revoker_index`
4. `20261007133000_phase18c_agent_assisted_onboarding`
5. `20261007233000_phase18e_delegated_message_actor`
6. `20261008011000_phase19c_marketplace_casework`
7. `20261008085000_phase19d_marketplace_content_enforcement`
8. `20261008114000_phase19e_enforcement_appeals`
9. `20261009130000_phase20a_notification_inbox`

Read-only source/catalog comparisons checked 125 expected columns, 16 enum definitions, 37 indexes, 23 foreign keys, 11 primary keys, API grants, RLS enablement and policies, and agent-proofs bucket rules. This is **not perfect proof of full database equivalence**: triggers, ownership, unlisted policies and differences introduced by later Supabase migrations require review. In particular, Phase 19C created casework tables with RLS but no `hustle_api` privileges, which was fixed separately in **PR #124**, merged into code, not yet applied to production.

Five later migrations require **new objects** absent from production:
1. `20261013090000_financial_durable_dispatch`
2. `20261013131500_moniflow_sandbox_receipt_observation`
3. `20261015122500_flowtime_adaptive_booking`
4. `20261015132000_flowtime_revision_access`
5. `20261016120000_marketplace_casework_api_access`

## What CI proves

`.github/workflows/prisma-ledger-rehearsal.yml` uses a brand-new GitHub-hosted PostgreSQL container with fixed loopback credentials and no Supabase, finance provider or Vercel secrets.

`scripts/experience/rehearse-prisma-ledger.sh` refuses to run without GitHub Actions, the exact sandbox URL and the expected database. It deploys the 27 September migrations, manually applies nine October SQL migrations without stamping Prisma, then calls Prisma's supported `migrate resolve --applied` for those nine **on the disposable database only**, and finally deploys the five truly pending migrations. It verifies 27→36→41 successful ledger entries and runs SQL access checks for casework and FlowTime.

**CI success is necessary but not sufficient for production readiness**. This simulated divergence uses the Prisma SQL migration files to create the nine physically-present objects, rather than recreating every historical Supabase SQL modification and every live row. It doesn't test constraints on the production dataset.

## Production STOP gates

- Do **not** run `prisma migrate deploy` or `prisma migrate resolve` directly on the live database based solely on CI.
- Take a **fresh encrypted, offsite-verified backup** (application DB, Auth, Storage metadata and bytes) immediately before a separately approved maintenance operation, and capture baseline table counts/ACLs.
- Review live `_prisma_migrations` and full hosted schema again; compare all nine migration definitions and expected side effects. Resolve only migrations proven equivalent.
- Validate finance refund uniqueness against **live rows** before attempting the Financial Dispatch migration (its new partial unique index could fail).
- Approve a specific maintenance window and explicit production database ledger/DDL change. No finance partner transactions.
- Preserve independent Supabase history; never hand-edit Prisma migration rows. Never erase production data to make a migration pass.
- Confirm new Prisma structures/RLS using `hustle_api`; deploy API only after schema checks and separate `DEPLOY` approval.
- Defer Storage original UUID/ownership and real sign-in validation to the disaster-recovery completion checklist. The application/Auth/Storage backup smoke tests already passed locally but do not prove full disaster recovery.

## Operator notes

This PR does **not** add a production write script or a GitHub job carrying production credentials. All workflow writes go to the ephemeral `hustle_payment_sandbox` container.
