#!/usr/bin/env python3
"""Combined generated/private-restore checks; never a production release tool."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import logging
import os
from pathlib import Path
import re
import secrets
import signal
import tempfile

import pending_migrations as pending
import private_pending_migrations as prior

audit, access, core, cloud = pending.audit, pending.access, pending.core, pending.cloud
private = audit.private
NODE_IMAGE='docker.io/library/node:22-bookworm@sha256:82693da96a4e38b8c0e2bf0c5df58fcb86d2d25e5a235c07748f09bfa38567c2'
WORKFLOW='realxpen/hustle-economy-of-you/.github/workflows/hustle-native-final-acceptance.yml@refs/heads/main'
CONFIRM='TEST_SAVED_UPGRADE'
PRISMA_TABLE='public."_prisma_migrations"'
API_URL='postgresql://hustle_api@127.0.0.1:5432/hustle_payment_sandbox?schema=public&connection_limit=5'
DEPLOY_URL='postgresql://postgres@127.0.0.1:5432/postgres?schema=public&connection_limit=2'
SANDBOX_URL='postgresql://postgres:sandbox_only@127.0.0.1:55439/hustle_payment_sandbox?schema=public'
LIVE_MEDIA_MIGRATION='20260918110000_phase17b_native_live_media'
LIVE_MEDIA_ORIGINAL_SHA='f519cdd9f270fbc0659126b6358fc4e486241b1988c0497a9034459d0ba50d4d'
LIVE_MEDIA_CURRENT_SHA='a1491c455613ffe8d80a085c91d00b2222bd1dcb816f5290363d11a4baf40a23'
LIVE_MEDIA_ORIGINAL=Path(__file__).with_name('fixtures')/'live-media-original.sql'


class Runtime(core.Database):
    """Public code mounts only; no host data or private input reaches Node."""
    def __init__(self,database,*,generated=False):
        super().__init__()
        self.database=database
        self.generated=generated
        self.name='hustle-private-application-'+self.token
        self.mounts={str(audit.ROOT / path):'/app/'+path for path in
                     ('node_modules','apps/api/dist','apps/api/prisma','scripts')}

    def start(self):
        self.database.guard()
        core.require(all(Path(p).is_dir() and not Path(p).is_symlink() for p in self.mounts),
                     'ACCEPTANCE_BUILD','Install locked dependencies and build the API before private inputs are exposed.')
        args=['docker','run','--detach','--name',self.name,'--label',core.LABEL+'='+self.token,
              '--network','container:'+self.database.name,'--read-only','--cap-drop=ALL',
              '--security-opt=no-new-privileges','--user','1000:1000','--memory=1024m',
              '--pids-limit=256','--cpus=2','--no-healthcheck','--log-driver=none',
              '--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=128m,mode=1777','--workdir','/app',
              '--env','HOME=/tmp','--env','PRISMA_HIDE_UPDATE_MESSAGE=1','--env','CHECKPOINT_DISABLE=1']
        for source,target in self.mounts.items():args+=['--mount','type=bind,src='+source+',dst='+target+',readonly']
        args += [NODE_IMAGE,'sleep','86400']
        self.created=True
        core.run(args)
        self.guard()

    def guard(self):
        self.database.guard()
        obj=json.loads(core.run(['docker','inspect',self.name]).stdout)[0]
        config,host=obj['Config'],obj['HostConfig']
        namespace=host.get('NetworkMode','').removeprefix('container:')
        binds={m['Source']:m['Destination'] for m in obj.get('Mounts',[]) if m['Type']=='bind' and not m.get('RW')}
        core.require(config.get('Labels',{}).get(core.LABEL)==self.token and obj['Name']=='/'+self.name
            and config['Image'] in (NODE_IMAGE,NODE_IMAGE.removeprefix('docker.io/'))
            and config['User']=='1000:1000' and namespace in (self.database.name,self.database.container_id)
            and host['ReadonlyRootfs'] and not host.get('Privileged') and not host.get('PortBindings')
            and 'ALL' in {s.upper() for s in host.get('CapDrop',[])}
            and any(s.startswith('no-new-privileges') for s in host.get('SecurityOpt',[]))
            and binds==self.mounts and all(m['Type']=='bind' and not m.get('RW') or
                m['Type']=='tmpfs' and m['Destination']=='/tmp' for m in obj.get('Mounts',[]))
            and host.get('LogConfig',{}).get('Type')=='none' and '/tmp' in host.get('Tmpfs',{}),
            'ACCEPTANCE_RUNTIME','The application container failed its offline/public-code-only boundary.')

    def execute(self,args,url,stage,timeout=180):
        self.guard()
        core.require(url in (DEPLOY_URL,API_URL,SANDBOX_URL),'ACCEPTANCE_URL','Only fixed isolated database URLs are allowed.')
        result=access.private_run(['docker','exec','--env','DATABASE_URL','--env','HUSTLE_SANDBOX_WEBHOOK_SECRET','--env','HUSTLE_GENERATED_ASSERTIONS',
            self.name,'node',*args],values={'DATABASE_URL':url,'HUSTLE_SANDBOX_WEBHOOK_SECRET':secrets.token_urlsafe(48),
            'HUSTLE_GENERATED_ASSERTIONS':'1' if self.generated else '0'},timeout=timeout)
        if result.returncode:
            # Only this explicitly generated runner may reveal fixture errors.
            # Actual saved-backup runs always use the default False.
            if self.generated:
                print((result.stdout+b'\n'+result.stderr).decode('utf8',errors='replace')[-5000:],flush=True)
            codes=re.findall(rb'\bP[0-9]{4}\b',result.stdout+b'\n'+result.stderr)
            suffix='_'+codes[0].decode() if codes else ''
            probe=re.search(rb'APPLICATION_ACCEPTANCE_FAILED:(ROLE|FIXTURES|PARTICIPANT_GUARDS|LAST_SLOT_RACE|OCCUPIED_SLOT|FUNDING_GUARD|FREE_START|EXTENSION_RACE|EXTENSION_CONFLICT|COMPLETE):',result.stderr)
            if probe:suffix+='_'+probe[1].decode()
            raise core.RestoreError('ACCEPTANCE_'+stage+suffix,'The isolated '+stage.lower().replace('_',' ')+' check failed; no private output was printed.')
        return result.stdout

    def prisma(self,*args):
        return self.execute(['/app/node_modules/prisma/build/index.js','migrate',*args,'--schema=/app/apps/api/prisma/schema.prisma'],DEPLOY_URL,'PRISMA')


def preflight():
    cloud.preflight()
    cloud.assert_clean()
    if core.run(['docker','image','inspect',NODE_IMAGE],check=False).returncode:
        core.run(['docker','pull',NODE_IMAGE],timeout=900)


def ledger(database):
    return json.loads(access.private_sql(database,'BEGIN READ ONLY; SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),\'[]\'::jsonb) FROM '+PRISMA_TABLE+' m; COMMIT;'))


def verify_live_media_reference(historical,actual):
    core.require(hashlib.sha256(LIVE_MEDIA_ORIGINAL.read_bytes()).hexdigest()==LIVE_MEDIA_ORIGINAL_SHA
        and hashlib.sha256((audit.MIGRATIONS/LIVE_MEDIA_MIGRATION/'migration.sql').read_bytes()).hexdigest()==LIVE_MEDIA_CURRENT_SHA,
        'ACCEPTANCE_LIVE_MEDIA_REVISION','The two reviewed live-media SQL revisions changed.')
    key='relation:LiveMediaPresence'
    core.require(key in historical and actual.get(key)==historical[key],
                 'ACCEPTANCE_LIVE_MEDIA_SCHEMA','The original live-media relation did not match the evaluated reference, including ownership, grants and RLS.')


def verify_history(rows,expected,*,legacy_schema_verified=False):
    successful=[r for r in rows if r.get('finished_at') is not None and r.get('rolled_back_at') is None]
    _,hashes=audit.inventory()
    core.require(len(successful)==len(expected) and {r['migration_name'] for r in successful}==set(expected),
                 'ACCEPTANCE_HISTORY','The successful Prisma migration names did not match the reviewed stage.')
    legacy=[r for r in successful if legacy_schema_verified and r['migration_name']==LIVE_MEDIA_MIGRATION
            and r['checksum']==LIVE_MEDIA_ORIGINAL_SHA and hashes[LIVE_MEDIA_MIGRATION]==LIVE_MEDIA_CURRENT_SHA]
    different=[r['migration_name'] for r in successful if r['checksum']!=hashes[r['migration_name']] and r not in legacy]
    core.require(not different,'ACCEPTANCE_HISTORY_CHECKSUM','Reviewed migration checksum mismatch: '+', '.join(sorted(different)))
    core.require(all(r.get('finished_at') is not None or r.get('rolled_back_at') is not None for r in rows),
                 'ACCEPTANCE_HISTORY_FAILED','An unresolved failed migration blocks this rehearsal.')
    return len(legacy)


def upgrade(database,runtime,historical,scopes,expected,affected,*,generated=False):
    before_schema=audit.snapshot(database)
    verify_live_media_reference(historical,before_schema)
    core.require(all(r['schema_contract_matched'] for r in audit.compare(historical,before_schema,scopes)),
                 'ACCEPTANCE_HISTORICAL','A historical schema contract differed; history was not resolved.')
    baseline,hashes=audit.inventory()
    pending.pending_sql() # Exact five original SHA-256 pins remain mandatory.
    pending.verify_source_pending(database)
    rows_before=ledger(database)
    legacy_count=verify_history(rows_before,baseline,legacy_schema_verified=True)
    table_list=pending.original_tables(database)
    unchanged=[t for t in table_list if (t['schema'],t['table'])!=('public','_prisma_migrations')]
    receipts=pending.fingerprints(database,unchanged)
    supabase=access.private_sql(database,'BEGIN READ ONLY; SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM supabase_migrations.schema_migrations m; COMMIT;') if not generated else None
    for name in audit.HISTORICAL:runtime.prisma('resolve','--applied',name)
    verify_history(ledger(database),baseline+audit.HISTORICAL,legacy_schema_verified=True)
    runtime.prisma('deploy')
    rows_after=ledger(database)
    verify_history(rows_after,baseline+audit.HISTORICAL+audit.PENDING,legacy_schema_verified=True)
    by_id={r['id']:r for r in rows_after}
    core.require(all(by_id.get(r['id'])==r for r in rows_before),'ACCEPTANCE_OLD_HISTORY','An original Prisma history row changed.')
    runtime.prisma('deploy')
    runtime.prisma('status')
    core.require(ledger(database)==rows_after,'ACCEPTANCE_REDEPLOY','A second migrate deploy was not a history no-op.')
    core.require(pending.fingerprints(database,unchanged)==receipts,'ACCEPTANCE_ROWS','Migration tooling changed original non-Prisma table contents.')
    pending.compare_after(before_schema,audit.snapshot(database),expected,affected)
    pending.verify_defaults(database,not generated)
    if not generated:
        core.require(access.private_sql(database,'BEGIN READ ONLY; SELECT jsonb_agg(to_jsonb(m) ORDER BY version) FROM supabase_migrations.schema_migrations m; COMMIT;')==supabase,
                     'ACCEPTANCE_SUPABASE_HISTORY','Supabase history changed during the rehearsal.')
    return unchanged,receipts,legacy_count


def applications(database,runtime):
    # access_contracts retains its fixed clone name and original SQL guards.
    pending.access_contracts(database)
    # Forward only inside the isolated namespace to retain the existing suite's
    # exact postgres@127.0.0.1:55439/hustle_payment_sandbox connection guard.
    proxy="""const net=require('node:net'),{spawn}=require('node:child_process');
const server=net.createServer(s=>{const d=net.connect(5432,'127.0.0.1');s.pipe(d);d.pipe(s);s.on('error',()=>d.destroy());d.on('error',()=>s.destroy());});
server.listen(55439,'127.0.0.1',()=>{const c=spawn(process.execPath,['/app/scripts/payment-sandbox/run.mjs'],{stdio:'inherit'});c.on('exit',code=>server.close(()=>process.exit(code===0?0:1)));});"""
    runtime.execute(['-e',proxy],SANDBOX_URL,'APPLICATION_SANDBOX',timeout=420)
    # Financial tables deliberately lack API-role table access. Verify no
    # attempts were created through the separate guarded local administrator,
    # retaining the application's original non-bypass privileges.
    attempts_sql='BEGIN READ ONLY; SELECT count(*) FROM public."PaymentAttempt"; COMMIT;'
    attempts_before=pending.sandbox_sql(database,attempts_sql)
    raw=runtime.execute(['/app/scripts/recovery/native_contract/application_acceptance.cjs'],API_URL,'BOOKING_CONCURRENCY')
    core.require(pending.sandbox_sql(database,attempts_sql)==attempts_before,'ACCEPTANCE_FUNDING_ATTEMPTS',
                 'Booking acceptance/start checks unexpectedly created a financial attempt.')
    expected={'last_slot_race_passed':True,'extension_race_and_conflict_passed':True,'participant_guards_passed':True,
              'unfunded_start_denied':True,'non_bypass_api_role':True}
    core.require(json.loads(raw)==expected,'ACCEPTANCE_APPLICATION_REPORT','The application result had unexpected fields.')


def api_checks(stack,folder,inputs,reference):
    database=stack.database
    core.require(core.restore_files(database,folder/(core.SET_ID+'-storage_files.tar.gz.enc'),inputs.backup_passphrase,reference)==10,
                 'ACCEPTANCE_FILES','All ten original files must recover and hash correctly.')
    schema=access.private_sql(database,access.SCHEMA_STATE)
    stack.services()
    objects={o['id']:o for o in reference['before']['objects']}
    for record in reference['file_hashes']:
        access.stage_backend(stack,record,objects[record['object_id']])
        access.assert_bytes(stack.request('storage',access.storage_path(record),token=stack.service_token,digest=True),record)
    user_id=access.account_info(stack,inputs.owner_email)
    proofs=access.private_proofs(reference,user_id)
    core.require(bool(proofs),'ACCEPTANCE_PROOFS','The existing consenting owner must own backed-up private proofs.')
    owner=stack.login(inputs.owner_email,inputs.owner_password,user_id)
    stranger=stack.create_generated_account()
    core.require(stranger['id']!=user_id,'ACCEPTANCE_OUTSIDER','The generated unrelated identity was not distinct.')
    outsider=stack.login(stranger['email'],stranger['password'],stranger['id'])
    proof_count,public_count=access.exercise_access(stack,reference,owner,outsider,proofs)
    core.require(access.private_sql(database,access.SCHEMA_STATE)==schema
                 and core.fingerprint(database.catalog())==core.fingerprint(reference['before']),
                 'ACCEPTANCE_API_METADATA','Original Storage metadata or Auth/Storage migration/policy definitions changed.')
    return proof_count,public_count


def reference_contract():
    database=core.Database()
    try:
        database.start()
        historical,scopes,_=audit.reference_contract(database)
        # On GENERATED data only, prove the exact 2026-09-18 revision and the
        # retry-safe 2026-10-04 revision evaluate to the same complete catalog.
        verify_live_media_reference(historical,historical)
        access.private_sql(database,'SET ROLE postgres; DROP TABLE public."LiveMediaPresence";\n'+LIVE_MEDIA_ORIGINAL.read_text())
        core.require(audit.snapshot(database)==historical,'ACCEPTANCE_LIVE_MEDIA_EQUIVALENCE',
                     'The original live-media SQL did not reproduce the current reference.')
        expected,affected=pending.pending_reference(database,historical)
        return historical,scopes,expected,affected
    finally:database.cleanup()


def generated_contract():
    historical,scopes,expected,affected=reference_contract()
    database=access.ApiDatabase();runtime=Runtime(database,generated=True)
    try:
        database.start()
        audit.reference_contract(database)
        access.private_sql(database,'ALTER ROLE postgres NOSUPERUSER;')
        pending.prepare_database_owner(database)
        runtime.start()
        baseline,_=audit.inventory()
        for name in baseline:runtime.prisma('resolve','--applied',name)
        # Reproduce the saved history without ever rewriting an actual row.
        access.private_sql(database,'UPDATE public."_prisma_migrations" SET checksum='+access.sql_literal(LIVE_MEDIA_ORIGINAL_SHA)
            +' WHERE migration_name='+access.sql_literal(LIVE_MEDIA_MIGRATION)+';')
        tables,rows,legacy_count=upgrade(database,runtime,historical,scopes,expected,affected,generated=True)
        core.require(legacy_count==1,'ACCEPTANCE_GENERATED_LEGACY','The original-checksum fixture was not exercised.')
        applications(database,runtime)
        core.require(pending.fingerprints(database,tables)==rows,'ACCEPTANCE_CLONE','Application tests changed the original generated database.')
    finally:core.cleanup_all([database,runtime])
    cloud.assert_clean()


def private_contract(folder,inputs):
    historical,scopes,expected,affected=reference_contract()
    stack=access.Stack();runtime=Runtime(stack.database)
    try:
        reference=core.read_reference(folder,inputs.backup_passphrase)
        stack.start_database();stack.database.restore(folder,inputs.backup_passphrase)
        core.compare_database(stack.database.catalog(),reference)
        pending.prepare_database_owner(stack.database)
        runtime.start()
        print('[1/3] Rehearsing Prisma resolve/deploy and original data/schema checks.',flush=True)
        tables,rows,legacy_count=upgrade(stack.database,runtime,historical,scopes,expected,affected)
        print('[2/3] Running the real application sandbox and concurrent API-role Booking checks.',flush=True)
        applications(stack.database,runtime)
        core.require(pending.fingerprints(stack.database,tables)==rows,'ACCEPTANCE_CLONE','Application tests changed the original restored database.')
        app_tables=[dict(t,columns=[c for c in t['columns'] if
            not (t['schema']=='storage' and t['table']=='objects' and c=='last_accessed_at')])
            for t in tables if t['schema'] in ('public','storage','supabase_migrations')]
        app_rows=pending.fingerprints(stack.database,app_tables)
        history=ledger(stack.database)
        print('[3/3] Recovering files and testing original login/refresh and Storage access after migration.',flush=True)
        proof_count,public_count=api_checks(stack,folder,inputs,reference)
        core.require(pending.fingerprints(stack.database,app_tables)==app_rows and ledger(stack.database)==history,
                     'ACCEPTANCE_API_ROWS','Post-migration API tests changed original application/Storage/history rows.')
        return {'original_non_prisma_tables_hashed':len(tables),'private_proofs_verified':proof_count,'public_files_verified':public_count,
                'reviewed_legacy_live_media_checksum_count':legacy_count}
    finally:
        try:core.cleanup_all([runtime])
        finally:stack.cleanup()


def guard():
    core.require(os.environ.get('GITHUB_WORKFLOW_REF')==WORKFLOW and os.environ.get('GITHUB_REF')=='refs/heads/main'
        and os.environ.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and os.environ.get('GITHUB_JOB')=='private-acceptance'
        and not os.environ.get('GITHUB_HEAD_REF') and os.environ.get('HUSTLE_ACCEPTANCE_CONFIRM')==CONFIRM
        and os.environ.get('HUSTLE_GENERATED_GATE')=='passed','ACCEPTANCE_JOB','Use the protected main-only combined workflow after its generated gate.')
    revision=os.environ.get('GITHUB_SHA','')
    core.require(re.fullmatch('[0-9a-f]{40}',revision) and core.run(['git','rev-parse','HEAD']).stdout.strip().decode()==revision,
                 'ACCEPTANCE_REVISION','The checkout must match the selected workflow revision.')
    root=Path(os.environ.get('RUNNER_TEMP',''))
    core.require(root.is_absolute() and str(root) not in ('/','/tmp') and root.is_dir() and not root.is_symlink()
        and root.stat().st_uid==os.getuid(),'ACCEPTANCE_TEMP','The owned runner temporary directory was invalid.')
    preflight()
    return root


def report(result):
    core.require(set(result)=={'original_non_prisma_tables_hashed','private_proofs_verified','public_files_verified','reviewed_legacy_live_media_checksum_count'}
        and all(type(v) is int and 0<=v<1000 for v in result.values())
        and result['original_non_prisma_tables_hashed']>0 and 0<result['private_proofs_verified']<=10
        and result['private_proofs_verified']+result['public_files_verified']<=10,'ACCEPTANCE_REPORT','Invalid aggregate acceptance result.')
    core.require(result['reviewed_legacy_live_media_checksum_count'] in (0,1),'ACCEPTANCE_REPORT','Unexpected legacy revision count.')
    return dict(result,format='hustle-combined-native-acceptance-v1',backup_set_id=core.SET_ID,
        inventory_sha256=core.INVENTORY_SHA256,repository_sha=os.environ['GITHUB_SHA'],
        checked_at=datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
        historical_contracts_matched=9,prisma_historical_resolutions=9,prisma_pending_deployed=5,
        successful_prisma_migrations=41,original_prisma_rows_preserved=True,supabase_ledger_unchanged=True,
        reviewed_live_media_revisions_schema_equivalent=True,original_legacy_checksum_not_rewritten=True,
        original_non_prisma_rows_preserved_through_deploy=True,second_deploy_noop=True,
        migrated_schema_defaults_and_permissions_passed=True,application_sandbox_suite_passed=True,
        non_bypass_api_booking_race_and_extensions_passed=True,original_files_rehashed_and_api_read=10,
        original_owner_login_refresh_passed=True,private_owner_other_user_anon_public_checks_passed=True,
        post_migration_auth_storage_contract_unchanged=True,original_app_storage_rows_preserved_after_api_checks=True,
        storage_read_access_timestamp_excluded_from_post_api_row_projection=True,
        temporary_containers_removed=True,encrypted_staging_removed=True,production_accessed=False,
        production_changed=False,production_history_resolution_authorized=False,real_money_movement=False,
        mfa_oauth_old_sessions_tested=False,all_original_accounts_tested=False,full_disaster_recovery_verified=False)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--generated',action='store_true');args=parser.parse_args()
    os.umask(0o077);logging.disable(logging.CRITICAL)
    signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(KeyboardInterrupt()))
    try:
        if args.generated:
            preflight();generated_contract()
            print('GENERATED COMBINED MIGRATION/APPLICATION ACCEPTANCE PASSED. Generated data only.')
            return 0
        inputs=private.take_inputs();root=guard()
        with tempfile.TemporaryDirectory(prefix='hustle-combined-acceptance-',dir=root) as temporary:
            drive=private.Drive(inputs.service_account);inputs.service_account=''
            folder=private.download_set(drive,Path(temporary));drive.credentials.token=None;del drive
            result=private_contract(folder,inputs)
        inputs=None;cloud.assert_clean()
        core.require(not Path(temporary).exists(),'ACCEPTANCE_CLEANUP','Encrypted staging was not removed.')
        core.private_write(root/'hustle-combined-acceptance.json',core.canonical(report(result))+b'\n')
        print('ACTUAL SAVED UPGRADE ACCEPTANCE PASSED: Prisma, application sandbox, concurrency and post-migration Auth/Storage; cleanup complete.')
        return 0
    except core.RestoreError as e:
        print('['+e.code+'] '+e.message);return 1
    except KeyboardInterrupt:
        print('[ACCEPTANCE_INTERRUPTED] No complete result.');return 1
    except Exception as e:
        print('[ACCEPTANCE_FAILED] '+type(e).__name__+'; no private output or passing report.');return 1
    finally:
        for name in private.SECRET_NAMES:os.environ.pop(name,None)


if __name__=='__main__':raise SystemExit(main())
