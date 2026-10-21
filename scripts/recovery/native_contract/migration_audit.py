#!/usr/bin/env python3
"""Fail-closed schema comparison, never a migration-history repair or deploy.

The reference is generated from committed SQL in a NEW network-disabled PG17
container. Only schema definitions and explicitly selected bucket settings are
compared. Private application rows and SQL errors never leave the container.
"""
import hashlib
import json
from pathlib import Path

import private_cloud as private

access, core, cloud = private.access, private.core, private.cloud
ROOT = Path(__file__).resolve().parents[3]
MIGRATIONS = ROOT / 'apps/api/prisma/migrations'
HISTORICAL = (
    '20261007110000_phase18a_agent_capability_foundation',
    '20261007114500_phase18b_agent_relationship_permissions',
    '20261007123000_phase18b_relationship_revoker_index',
    '20261007133000_phase18c_agent_assisted_onboarding',
    '20261007233000_phase18e_delegated_message_actor',
    '20261008011000_phase19c_marketplace_casework',
    '20261008085000_phase19d_marketplace_content_enforcement',
    '20261008114000_phase19e_enforcement_appeals',
    '20261009130000_phase20a_notification_inbox',
)
PENDING = (
    '20261013090000_financial_durable_dispatch',
    '20261013131500_moniflow_sandbox_receipt_observation',
    '20261015122500_flowtime_adaptive_booking',
    '20261015132000_flowtime_revision_access',
    '20261016120000_marketplace_casework_api_access',
)
SKIP = '20260917130500_phase16b_story_rls_hardening'

# These are schema-only stand-ins for managed services, not Auth/Storage API
# acceptance. public migration SQL is executed as postgres, as on the source.
BOOTSTRAP = """
CREATE ROLE postgres SUPERUSER LOGIN;
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
SET ROLE postgres;
-- Reviewed source pg_default_acl on 2026-10-21. These grants reproduce the
-- platform baseline in the GENERATED reference only. Actual grants are still
-- compared exactly; no role/ACL is filtered or normalized away.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
 GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
CREATE FUNCTION storage.foldername(path text) RETURNS text[] LANGUAGE sql IMMUTABLE
AS $$ SELECT string_to_array(path, '/') $$;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,
 public boolean NOT NULL DEFAULT false,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 bucket_id text REFERENCES storage.buckets(id),name text NOT NULL,created_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
"""

# No user/object names or contents from storage.objects, auth.users or application
# tables are selected. All relation/column names here come from system catalogs.
# Explicit ordering prevents incidental OID/creation-order differences. Whole
# touched relations catch unexpected columns, policies, grants and indexes too.
SNAPSHOT = """
SET search_path = public, pg_catalog;
WITH entries AS (
 SELECT 'relation:'||c.relname AS key, jsonb_build_object(
  'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,
  'force_rls',c.relforcerowsecurity,'replica_identity',c.relreplident,
  'options',c.reloptions,
  'acl',(SELECT jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
     pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
     ORDER BY a.grantee::regrole::text,a.grantor::regrole::text,a.privilege_type,a.is_grantable)
     FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,
    'collation',CASE WHEN a.attcollation=0 THEN NULL ELSE a.attcollation::regcollation::text END,
    'acl',a.attacl::text,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_array(x.conname,pg_get_constraintdef(x.oid,true),x.convalidated,
    x.condeferrable,x.condeferred) ORDER BY x.conname) FROM pg_constraint x WHERE x.conrelid=c.oid),
  'indexes',(SELECT jsonb_agg(jsonb_build_array(ic.relname,pg_get_indexdef(i.indexrelid),i.indisvalid,
    i.indisready,i.indisreplident) ORDER BY ic.relname) FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid WHERE i.indrelid=c.oid),
  'policies',(SELECT jsonb_agg(jsonb_build_array(p.policyname,p.permissive,p.roles,p.cmd,p.qual,p.with_check)
    ORDER BY p.policyname) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname),
  'triggers',(SELECT jsonb_agg(jsonb_build_array(t.tgname,pg_get_triggerdef(t.oid,true),t.tgenabled)
    ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal),
  'rules',(SELECT jsonb_agg(jsonb_build_array(r.rulename,pg_get_ruledef(r.oid,true)) ORDER BY r.rulename)
    FROM pg_rewrite r WHERE r.ev_class=c.oid),
  'view',CASE WHEN c.relkind IN ('v','m') THEN pg_get_viewdef(c.oid,true) ELSE NULL END
 ) AS value FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f') AND c.relname<>'_prisma_migrations'
 UNION ALL
 SELECT 'enum:'||t.typname, jsonb_build_object('owner',pg_get_userbyid(t.typowner),
  'labels',jsonb_agg(e.enumlabel ORDER BY e.enumsortorder))
 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
 WHERE n.nspname='public' GROUP BY t.oid,t.typname,t.typowner
 UNION ALL
 SELECT 'function:'||p.oid::regprocedure::text,jsonb_build_object('definition',pg_get_functiondef(p.oid),
  'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')
 UNION ALL
 SELECT 'storage_policy:'||policyname,jsonb_build_object('permissive',permissive,'roles',roles,
  'command',cmd,'using',qual,'check',with_check) FROM pg_policies
 WHERE schemaname='storage' AND tablename='objects'
 UNION ALL
 SELECT 'bucket:'||id,jsonb_build_object('name',name,'public',public,'file_size_limit',file_size_limit,
  'allowed_mime_types',allowed_mime_types) FROM storage.buckets WHERE id IN ('agent-proofs','hustler-proofs','message-attachments','story-media')
 UNION ALL
 SELECT 'role:hustle_api',jsonb_build_object('superuser',rolsuper,'inherit',rolinherit,'create_role',rolcreaterole,
  'create_db',rolcreatedb,'login',rolcanlogin,'replication',rolreplication,'bypass_rls',rolbypassrls,
  'connection_limit',rolconnlimit,'settings',rolconfig,
  'memberships',(SELECT jsonb_agg(jsonb_build_array(r.rolname,m.admin_option,m.inherit_option,m.set_option)
    ORDER BY r.rolname) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid WHERE m.member=pg_roles.oid))
 FROM pg_roles WHERE rolname='hustle_api'
 UNION ALL
 SELECT 'default_acl:public:postgres:'||d.defaclobjtype::text,
  (SELECT jsonb_agg(jsonb_build_array(CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
   pg_get_userbyid(a.grantor),a.privilege_type,a.is_grantable)
   ORDER BY a.grantee::regrole::text,a.grantor::regrole::text,a.privilege_type,a.is_grantable)
   FROM aclexplode(d.defaclacl) a)
 FROM pg_default_acl d JOIN pg_namespace n ON n.oid=d.defaclnamespace
 WHERE n.nspname='public' AND pg_get_userbyid(d.defaclrole)='postgres'
  AND d.defaclobjtype IN ('r','S','f')
)
SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) FROM entries;
"""


def snapshot(database):
    return json.loads(access.private_sql(database, 'BEGIN READ ONLY;\n' + SNAPSHOT + '\nCOMMIT;'))


def inventory():
    files = sorted(MIGRATIONS.glob('*/migration.sql'))
    names = [p.parent.name for p in files]
    baseline = tuple(n for n in names if n.startswith('202609'))
    core.require(len(names) == 41 and len(baseline) == 27
                 and set(names) == set(baseline + HISTORICAL + PENDING),
                 'AUDIT_INVENTORY', 'The reviewed 41-migration inventory changed; review the contract before proceeding.')
    return baseline, {p.parent.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def apply_reference(database, name):
    core.require(name in inventory()[1] and name != SKIP,
                 'AUDIT_REFERENCE', 'Only the reviewed reference migration is allowed.')
    # The fixed bootstrap is owned by the same guarded disposable database.
    access.private_sql(database, 'SET ROLE postgres;\n' + (MIGRATIONS / name / 'migration.sql').read_text())


def reference_contract(database):
    baseline, fingerprints = inventory()
    access.private_sql(database, BOOTSTRAP)
    for name in baseline:
        if name != SKIP:
            apply_reference(database, name)
    before = snapshot(database)
    scopes = {}
    for name in HISTORICAL:
        apply_reference(database, name)
        after = snapshot(database)
        scopes[name] = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
        core.require(bool(scopes[name]), 'AUDIT_SCOPE', 'A historical migration produced no auditable schema effect.')
        before = after
    # Security-role attributes and memberships are prerequisites for EVERY scope.
    core.require(all('default_acl:public:postgres:' + kind in before for kind in ('r','S','f')),
                 'AUDIT_BASELINE', 'The generated platform default privilege baseline was incomplete.')
    for keys in scopes.values():
        keys.append('role:hustle_api')
        keys.extend('default_acl:public:postgres:' + kind for kind in ('r','S','f'))
    return before, scopes, fingerprints


def compare(expected, actual, scopes):
    results = []
    for name in HISTORICAL:
        keys = scopes[name]
        differences = [k for k in keys if (k in expected) != (k in actual) or expected.get(k) != actual.get(k)]
        # Only fixed catalog FIELD names from the generated reference are
        # published. No differing values or actual-only private names escape.
        fields = {k: [field for field in sorted(expected[k]) if expected[k].get(field) != actual.get(k, {}).get(field)]
                  for k in differences if isinstance(expected.get(k), dict) and isinstance(actual.get(k, {}), dict)}
        results.append({'migration': name, 'objects_checked': len(keys),
                        'schema_contract_matched': not differences, 'differing_objects': differences,
                        'differing_fields': fields})
    return results


def generated_contract():
    database = core.Database()
    try:
        database.start()
        expected, scopes, _ = reference_contract(database)
        actual = snapshot(database)
        core.require(all(x['schema_contract_matched'] for x in compare(expected, actual, scopes)),
                     'AUDIT_FIXTURE', 'The generated reference did not match itself.')
        # Prove the checker notices extra columns, missing indexes, broader grants,
        # RLS disablement and altered bucket policy/config, not just object names.
        perturbations = (
            'ALTER TABLE "AgentApplication" ADD COLUMN unexpected_contract_column text;',
            'DROP INDEX "AgentApplication_status_idx";',
            'GRANT SELECT ON "AgentAssistedRegistration" TO anon;',
            'ALTER TABLE "AgentApplication" DISABLE ROW LEVEL SECURITY;',
            "UPDATE storage.buckets SET public=true WHERE id='agent-proofs';",
            'ALTER POLICY agent_proofs_select_own ON storage.objects USING (true);',
            'ALTER ROLE hustle_api BYPASSRLS;',
            'REVOKE ALL ON "AgentApplication" FROM service_role;',
            'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM service_role;',
        )
        for sql in perturbations:
            altered = json.loads(access.private_sql(database, 'BEGIN;\n' + sql + '\n' + SNAPSHOT + '\nROLLBACK;'))
            core.require(any(not x['schema_contract_matched'] for x in compare(expected, altered, scopes)),
                         'AUDIT_FIXTURE', 'A generated unsafe schema mutation escaped detection.')
        # Test committed pending SQL and existing server/browser access assertions
        # on generated data only. This does not resolve either real ledger.
        for name in PENDING:
            apply_reference(database, name)
        access.private_sql(database, 'CREATE DATABASE hustle_payment_sandbox TEMPLATE postgres;')
        for path in ('casework-access-check.sql', 'flowtime-revision-access-check.sql'):
            result = access.private_run(database.command('psql', ['--dbname=hustle_payment_sandbox', '-X', '-qAt',
                '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate', '-f', '-'], True),
                data=(ROOT / 'scripts/experience' / path).read_bytes())
            if result.returncode:
                raise core.import_error('AUDIT_GENERATED_ACCESS', result.stderr)
    finally:
        database.cleanup()
    cloud.assert_clean()


if __name__ == '__main__':
    try:
        cloud.preflight()
        cloud.assert_clean()
        generated_contract()
        print('GENERATED MIGRATION AUDIT CONTRACT PASSED: nine schema scopes, nine drift detections, five later SQL migrations and access assertions.')
        print('Generated data only. No actual backup equivalence or production change is claimed.')
    except core.RestoreError as error:
        print('[' + error.code + '] ' + error.message)
        raise SystemExit(1)
