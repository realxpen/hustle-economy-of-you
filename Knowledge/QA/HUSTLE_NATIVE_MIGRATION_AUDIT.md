# Saved native migration audit — not production activation

Date: 2026-10-21. Owner approved continuing engineering without terminal work.

## Actual first comparison and reference correction

[Audit 39675092400](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39675092400) completed on `c192295bb9157d72c29ae8377a3073bf3371f69b`; all nine historical groups reported differences, across 15 relation definitions. Cleanup and unchanged ledgers passed. Verified artifact ZIP SHA-256 `0b1adeb8aa0e490c1fc1ea522261cc11038203454b93699b965e67a1d786f49d`; verified JSON SHA-256 `c914a21dec5f3fd3f391dffcc611088df58baeb8e95e36f358be0b5673bc5c98`. This was a completed diagnostic, not equivalent schema or authorization to stamp history.

Read-only metadata inspection identified a missing managed baseline in the independent reference: existing Supabase public tables inherit grants to `anon`, `authenticated` and `service_role`. The source `postgres` default privileges for public tables/sequences/functions were inspected on October 21. The reference now explicitly reproduces those reviewed defaults, including the owner, then executes the original SQL's grants/revokes. It also compares those three default ACL definitions in every migration scope; no role or grant is ignored. Field names for mismatched catalog properties are reported without private values, making remaining differences actionable. Generated mutation checks include removal of service-role grants and changes to the default ACL itself.

This change affects only the generated reference and diagnostic output. It does not recommend retaining broad browser grants, certify runtime access, alter production or change the saved backup. The source's RLS and historical SQL remain subject to exact comparison and later security review. Supabase's current [API security guide](https://supabase.com/docs/guides/api/securing-your-api) documents automatic grants on existing projects and the transition toward explicit grants. The metadata read establishes this project's actual baseline; it does not assume every Supabase project has the same defaults.

## Completed private-backup acceptance

[Run 39650103698 attempt 3](https://github.com/realxpen/hustle-economy-of-you/actions/runs/39650103698/attempts/3) **PASSED** on `d7aaf9a0ea9e65263e4c30268b480d7785c842b6`. Both jobs succeeded. Aggregate artifact `12375412558` was downloaded and ZIP SHA-256 independently verified: `e665a1ee697f45a97f16bad176e438b683bcb19af53359ff4371604954dd216c`. JSON report SHA-256: `11dd47b5f900f6b1fac932033f3a4a73ca8032fe60c53e82152a271dffe9bc89`.

- Exact October 20 native database/roles restored; all 10 original file digests and Storage API reads passed.
- One restored password account signed in and refreshed. Six original private proofs were byte-verified for their owner and denied to another signed-in user, anonymous access and the public route.
- Original Storage metadata/policies and Auth/Storage ledgers were unchanged. Temporary containers and downloaded encrypted copies were removed. No production access.
- No public original files were covered. MFA/OAuth, other original accounts, old sessions, message participants, application flows, external configuration, atomic capture and full disaster recovery remain unverified.

Earlier attempts stopped at missing secrets and owner selection; the successful run supersedes them. Do not restart capture or account setup to continue migration preparation.

## New comparison boundary

`migration_audit.py` builds an independent schema reference from committed September migrations (skipping the known duplicate Story RLS migration, as established CI does), then nine historical October migrations. Every SQL file's SHA-256 is recorded. It compares each historical migration's affected objects against the **final** reference state, including subsequent historical changes to shared objects.

The PostgreSQL-evaluated catalog contract includes columns/types/defaults/collations, constraints, indexes/validity, table ownership, table/column ACLs, RLS flags and row policies, triggers, rules/views, enum label order, public function definitions, selected Storage bucket settings and object policies. `hustle_api` attributes/memberships are checked in every scope. Whole touched relations detect unexpected columns, indexes, grants or policies.

Reference managed Auth/Storage schemas are **minimal schema-only stand-ins**, not managed-service acceptance. Conservative differences need review; never normalize away security differences to get a pass. Only schema/configuration effects are compared: data semantics, runtime behavior, full dependency closure and global/default privileges still need review. Even a schema match does **not** certify or authorize migration-history repair.

Generated cloud tests exercise the actual query, matching reference, seven unsafe schema mutations, five later SQL migrations and existing casework/FlowTime non-bypass API/browser-role assertions. Generated data is not private restored-data migration proof.

## Actual-backup workflow

`Hustle Saved Native Migration Audit` is manual, main-only, confirmation-guarded, GitHub-hosted and protected by `hustle-cloud-recovery`. It reuses ONLY existing Drive reader and backup passphrase secrets. No owner account/password, laptop command, new Supabase project or production connection is needed.

After merge: open the workflow in GitHub, select main, enter `AUDIT_SAVED_MIGRATIONS`. The connector has no workflow-dispatch operation; the browser-only start remains an owner handoff.

The secret-free generated gate must pass first. The private job downloads/verifies the exact eleven encrypted backup files and previously verified native restore report. A new network-disabled target strictly imports roles/native database; subsequent catalog queries are explicitly read-only. Both migration ledgers and original capture comparisons must remain unchanged. Repository migrations and history-resolution operations NEVER execute against the actual backup target.

Only after cleanup is `hustle-native-migration-audit.json` published: per-migration match status, repository-defined differing object keys, SQL hashes, checkout SHA and explicit negative authority flags. No account emails, private filenames, table contents, SQL definitions, passwords or decrypted files are published. Workflow success means **diagnostic completed**, not equivalence passed: inspect `historical_schema_contracts_all_matched` and individual results. Differences keep equivalence blocked.

## Following milestone

Review differences, required data effects and security dependencies; prepare reviewed repairs where needed. Rehearse proven historical resolution and pending migrations on another fresh restored copy with row-preservation, privileges and booking concurrency checks. Revalidate live read-only metadata before proposing rollout. No production DDL, ledger stamps, deployment or provider activation is authorized by this audit.

Sources reviewed: [migration tracking/repair](https://supabase.com/docs/guides/deployment/database-migrations), [restore guidance](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [changelog](https://supabase.com/changelog). The October 12 HTTP TLS change does not affect offline PostgreSQL comparison.
