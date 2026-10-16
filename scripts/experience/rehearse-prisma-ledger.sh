#!/usr/bin/env bash
set -Eeuo pipefail

# ONLY a disposable GitHub Actions database. Never connect this script to live
# Supabase, a developer database, or a private database URL.
readonly EXPECTED_URL='postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public'
if [[ "${DATABASE_URL:-}" != "$EXPECTED_URL" ]]; then
  echo 'REFUSED: Ledger rehearsal requires the exact throwaway CI database URL.' >&2
  exit 2
fi
if [[ "$PWD" != "$GITHUB_WORKSPACE" || -z "${GITHUB_ACTIONS:-}" ]]; then
  echo 'REFUSED: Ledger rehearsal can run only at the GitHub Actions checkout.' >&2
  exit 2
fi

psql_local() {
  PGPASSWORD=sandbox_only psql -X -v ON_ERROR_STOP=1 \
    -h 127.0.0.1 -p 55439 -U postgres -d hustle_payment_sandbox "$@"
}
if [[ "$(psql_local -Atc 'SELECT current_database()')" != 'hustle_payment_sandbox' ]]; then
  echo 'REFUSED: Not connected to the disposable database.' >&2
  exit 2
fi

readonly prisma_source='apps/api/prisma'
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
mkdir -p "$workdir/migrations"
cp "$prisma_source/schema.prisma" "$workdir/schema.prisma"

# Sept migrations include the historical duplicate Story RLS migration. The
# repo's existing isolated PostgreSQL CI resolves this redundant historical
# migration before the rest of Prisma migrate deploy; rehearse that same rule.
for d in "$prisma_source"/migrations/202609*/; do
  [[ -d "$d" ]] || { echo 'No September migrations found' >&2; exit 1; }
  cp -a "$d" "$workdir/migrations/"
done

echo 'STEP 1: Deploy only September baseline to disposable PostgreSQL'
npx prisma migrate resolve \
  --applied 20260917130500_phase16b_story_rls_hardening \
  --schema="$workdir/schema.prisma"
npx prisma migrate deploy --schema="$workdir/schema.prisma"

count_applied() {
  psql_local -Atc 'SELECT COUNT(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;'
}
if [[ "$(count_applied)" != '27' ]]; then
  echo "Expected 27 baseline migrations; got $(count_applied)" >&2
  exit 1
fi

# These nine Prisma SQL files represent historical changes made through a
# different migration authority. Apply the physical SQL in the sandbox,
# without recording Prisma history, to recreate the production divergence.
historically_present=(
  20261007110000_phase18a_agent_capability_foundation
  20261007114500_phase18b_agent_relationship_permissions
  20261007123000_phase18b_relationship_revoker_index
  20261007133000_phase18c_agent_assisted_onboarding
  20261007233000_phase18e_delegated_message_actor
  20261008011000_phase19c_marketplace_casework
  20261008085000_phase19d_marketplace_content_enforcement
  20261008114000_phase19e_enforcement_appeals
  20261009130000_phase20a_notification_inbox
)

echo 'STEP 2: Apply October schema without recording its Prisma history'
for name in "${historically_present[@]}"; do
  echo "Sandbox physical schema: $name"
  psql_local -f "$prisma_source/migrations/$name/migration.sql" >/dev/null
done
if [[ "$(count_applied)" != '27' ]]; then
  echo 'The October schema simulation must not stamp Prisma history.' >&2
  exit 1
fi

# Make the exact unmodified, committed later migration SQL visible to Prisma.
for d in "$prisma_source"/migrations/202610*/; do
  [[ -d "$d" ]] || { echo 'No October migrations found' >&2; exit 1; }
  cp -a "$d" "$workdir/migrations/"
done

if [[ "$(find "$workdir/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')" != '41' ]]; then
  echo 'Migration inventory changed: review rehearsal before adding later migrations.' >&2
  exit 1
fi

echo 'STEP 3: Reconcile nine missing Prisma ledger entries in disposable database'
for name in "${historically_present[@]}"; do
  npx prisma migrate resolve --applied "$name" --schema="$workdir/schema.prisma"
done
if [[ "$(count_applied)" != '36' ]]; then
  echo "Expected 36 rehearsed ledger entries, got $(count_applied)" >&2
  exit 1
fi

echo 'STEP 4: Apply five genuinely missing migrations (disposable database only)'
npx prisma migrate deploy --schema="$workdir/schema.prisma"
npx prisma migrate status --schema="$workdir/schema.prisma"

if [[ "$(count_applied)" != '41' ]]; then
  echo "Expected all 41 migrations applied, got $(count_applied)" >&2
  exit 1
fi

echo 'STEP 5: Verify casework and FlowTime server-only RLS'
psql_local -f scripts/experience/casework-access-check.sql
psql_local -f scripts/experience/flowtime-revision-access-check.sql

echo 'ISOLATED PRISMA LEDGER RECONCILIATION REHEARSAL PASSED (27 + 9 + 5).'
echo 'This did not connect to, migrate, or stamp any production database.'
