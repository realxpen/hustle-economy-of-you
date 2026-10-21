import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('restore', Path(__file__).with_name('hustle-restore-test-v2.py'))
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
PASSWORD = 'generated-test-passphrase-only'
DATA = b'generated private fixture' * 1000


def reference(data=DATA):
    obj = {'id':'generated-id','bucket_id':'generated-bucket','name':'proof/file.txt','owner_id':'generated-owner',
           'version':'v1','metadata':{'size':len(data)},'created_at':'2026-01-01T00:00:00Z','last_accessed_at':None}
    bucket = {'id':'generated-bucket','name':'generated-bucket','public':False}
    catalog = {'buckets':[bucket],'objects':[obj],'observed_counts':{'users':1,'services':1,'bookings':1,'notifications':1,'auth_users':1,'auth_identities':1,'prisma_migrations':1,'supabase_migrations':1}}
    record = {'bucket_id':obj['bucket_id'],'name':obj['name'],'object_id':obj['id'],'version':obj['version'],
              'relative_path':'objects/'+hashlib.sha256((obj['bucket_id']+'\0'+obj['name']).encode()).hexdigest(),
              'size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
    return {'source_project_ref':r.PROJECT,'cross_service_atomic':False,'before':catalog,'after':json.loads(json.dumps(catalog)),'file_hashes':[record]}


class GeneratedFiles:
    def __init__(self,path):self.path=path
    def command(self,program,args=(),input_stream=False):
        if program=='tar':
            actual=list(args);actual[actual.index('-C')+1]=str(self.path)
            return ['tar']+actual
        return ['/bin/sh','-c','cd "'+str(self.path)+'"; if [ -d objects ]; then find objects -type f -exec sha256sum "{}" +; fi']


class RestoreTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()

    def encrypt(self,data,name='fixture.enc'):
        path=self.path/name
        r.encrypt_fixture(path,PASSWORD,data=data)
        return path

    def archive(self,ref, *, data=DATA, extra=None, duplicate=False):
        out=io.BytesIO()
        record=ref['file_hashes'][0]
        with tarfile.open(fileobj=out,mode='w:gz') as tar:
            pairs=[(record['relative_path'],data),('file-hashes.json',r.canonical({'source_project_ref':r.PROJECT,'files':ref['file_hashes']})),
                   ('storage-catalog.json',r.canonical({'buckets':ref['before']['buckets'],'objects':ref['before']['objects']}))]
            if duplicate:pairs.append(pairs[0])
            for name,body in pairs:
                info=tarfile.TarInfo(name);info.size=len(body)
                tar.addfile(info,io.BytesIO(body))
            if extra:tar.addfile(extra)
        return self.encrypt(out.getvalue())

    def test_passphrase_is_not_in_process_args_or_environment(self):
        path=self.encrypt(DATA)
        actual=r.decrypt_small(path,PASSWORD)
        self.assertEqual(actual,DATA)
        with patch.dict(os.environ,{'PGHOST':'production.invalid','PGPASSWORD':'fake-production-fixture','DATABASE_URL':'fake-url','SUPABASE_SERVICE_ROLE_KEY':'fixture-key'}):
            env=r.clean_environment()
        self.assertNotIn('PGHOST',env);self.assertNotIn('PGPASSWORD',env)
        self.assertNotIn('DATABASE_URL',env);self.assertNotIn('SUPABASE_SERVICE_ROLE_KEY',env)

    def test_wrong_passphrase_and_truncation_fail(self):
        path=self.encrypt(DATA)
        with self.assertRaises(r.RestoreError):r.decrypt_small(path,'wrong-generated-passphrase')
        path.write_bytes(path.read_bytes()[:-5])
        with self.assertRaises(r.RestoreError):r.decrypt_small(path,PASSWORD)

    def test_actual_openssl_pipeline_transfers_full_native_bytes(self):
        data=b'PGDMP'+os.urandom(750000)
        path=self.encrypt(data)
        target=self.path/'generated-import.bin'
        cmd=[sys.executable,'-c','import pathlib,sys;pathlib.Path(sys.argv[1]).write_bytes(sys.stdin.buffer.read())',str(target)]
        r.stream_restore(path,PASSWORD,cmd,'GENERATED_IMPORT')
        self.assertEqual(target.read_bytes(),data)

    def test_failed_import_and_empty_plaintext_cannot_pass(self):
        path=self.encrypt(DATA*100)
        with self.assertRaises(r.RestoreError) as result:
            r.stream_restore(path,PASSWORD,[sys.executable,'-c','raise SystemExit(1)'],'GENERATED_IMPORT')
        self.assertEqual(result.exception.code,'GENERATED_IMPORT')
        path=self.encrypt(b'',name='empty.enc')
        with self.assertRaises(r.RestoreError):
            r.stream_restore(path,PASSWORD,[sys.executable,'-c','import sys;sys.stdin.buffer.read()'],'GENERATED_IMPORT')

    def test_roles_import_has_stdin_and_native_import_retains_ownership_and_privileges(self):
        db=r.Database();db.created=True
        cmd=db.command('psql',['--single-transaction','-f','-'],True)
        self.assertIn('-i',cmd)
        self.assertIn('--host=/tmp/hustle/socket',cmd)
        self.assertIn('--no-password',cmd)
        self.assertNotIn('--no-owner',cmd);self.assertNotIn('--no-privileges',cmd)
        text=' '.join(cmd)
        self.assertNotIn(PASSWORD,text);self.assertNotIn('supabase.co',text)
        self.assertFalse(any('PGPASSWORD=' in x for x in cmd))

    def role_sql(self):
        return b'''-- generated pg_dumpall role fixture
\\restrict generatedkey
SET default_transaction_read_only = off;
SET standard_conforming_strings = on;
CREATE ROLE postgres;
ALTER ROLE postgres WITH NOSUPERUSER INHERIT CREATEROLE CREATEDB LOGIN;
CREATE ROLE supabase_admin;
ALTER ROLE supabase_admin WITH SUPERUSER INHERIT CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS;
ALTER ROLE supabase_admin SET search_path TO 'public', 'extensions';
GRANT pg_monitor TO postgres WITH ADMIN OPTION GRANTED BY supabase_admin;
\\unrestrict generatedkey
'''

    def test_source_bootstrap_mapping_preserves_all_alters_grants_and_original_ciphertext(self):
        raw=self.role_sql()
        path=self.encrypt(raw)
        before=path.read_bytes()
        mapped=r.bootstrap_role_sql(r.decrypt_small(path,PASSWORD))
        self.assertEqual(path.read_bytes(),before)
        self.assertNotIn(b'\nCREATE ROLE supabase_admin;\n',mapped)
        self.assertIn(b'\nCREATE ROLE postgres;\n',mapped)
        original=[line for line in raw.splitlines() if line.startswith((b'ALTER ',b'GRANT '))]
        self.assertEqual(original,[line for line in mapped.splitlines() if line.startswith((b'ALTER ',b'GRANT '))])
        self.assertEqual(raw.count(b'\n'),mapped.count(b'\n'))
        self.assertEqual(r.Database().admin,r.BOOTSTRAP_ROLE)

    def test_bootstrap_mapping_never_edits_strings_quoted_identifiers_or_comments(self):
        additions=[
            "COMMENT ON ROLE postgres IS 'café\nCREATE ROLE supabase_admin;\nALTER ROLE supabase_admin WITH SUPERUSER LOGIN;\ncan''t';\n",
            "COMMENT ON ROLE postgres IS E'private\\\\path\\\'\nCREATE ROLE supabase_admin;\n';\n",
            "COMMENT ON ROLE postgres IS $fixture$\nCREATE ROLE supabase_admin;\n$fixture$;\n",
            'COMMENT ON ROLE "quoted\nCREATE ROLE supabase_admin;\nname" IS \'fixture\';\n',
            '/* outer\n/* nested */\nCREATE ROLE supabase_admin;\n*/\n',
            '-- CREATE ROLE supabase_admin;\n',
        ]
        for addition in additions:
            for source in (addition.encode()+self.role_sql(),self.role_sql()+addition.encode()):
                with self.subTest(addition=addition):
                    mapped=r.bootstrap_role_sql(source)
                    self.assertIn(addition.encode(),mapped)
                    self.assertEqual(source.count(b'\n'),mapped.count(b'\n'))
        crlf=self.role_sql().replace(b'\n',b'\r\n')
        mapped=r.bootstrap_role_sql(crlf)
        self.assertEqual(crlf.count(b'\r\n'),mapped.count(b'\r\n'))

    def test_unexpected_bootstrap_role_contracts_fail_before_import(self):
        raw=self.role_sql()
        cases=(raw.replace(b'CREATE ROLE supabase_admin;\n',b''),
               raw+b'CREATE ROLE supabase_admin;\n',
               raw.replace(b'WITH SUPERUSER',b'WITH NOSUPERUSER'),
               raw.replace(b'CREATEDB LOGIN REPLICATION',b'CREATEDB NOLOGIN REPLICATION'),
               raw+b"COMMENT ON ROLE postgres IS 'unterminated",raw+b'/* incomplete',
               raw+b'COMMENT ON ROLE postgres IS $tag$incomplete',raw+b'\xff')
        for case in cases:
            with self.subTest(case=case[-40:]),self.assertRaises(r.RestoreError):r.bootstrap_role_sql(case)

    def test_private_diagnostics_emit_only_anchored_sqlstate_and_line_number(self):
        stderr=b'private identifier and SQL must stay hidden\npsql:<stdin>:113: ERROR:  42501\nsecret fixture value\n'
        error=r.import_error('RESTORE_ROLES',stderr)
        self.assertEqual(error.code,'RESTORE_ROLES_42501')
        self.assertIn('113',error.message)
        self.assertNotIn('private',error.message.replace('No private SQL or error text was printed.',''))
        self.assertNotIn('secret fixture',error.message)
        for stderr in (b'psql:<stdin>:7: ERROR:  privateidentifier\n',
                       b'psql:<stdin>:7: ERROR:  42501 private SQL\n',b'private 42501 text'):
            error=r.import_error('RESTORE_ROLES',stderr)
            self.assertEqual(error.code,'RESTORE_ROLES')

    def test_real_encryption_to_roles_import_retains_strict_errors_and_bootstrap_guard(self):
        raw=self.role_sql()
        path=self.encrypt(raw,r.SET_ID+'-roles.sql.enc')
        original=path.read_bytes()
        db=r.Database();db.created=True
        calls=[]
        def consumer(args,**kwargs):
            calls.append((args,kwargs))
            self.assertEqual(kwargs['data'],r.bootstrap_role_sql(raw))
            return subprocess.CompletedProcess(args,0,b'',b'')
        with patch.object(db,'guard'),patch.object(db,'sql',return_value=b'1'),patch.object(r,'run',side_effect=consumer),patch.object(r,'stream_restore') as native:
            db.restore(self.path,PASSWORD)
        self.assertEqual(len(calls),1)
        command,options=calls[0]
        self.assertIn('--username=supabase_admin',command)
        self.assertIn('ON_ERROR_STOP=1',command)
        self.assertIn('VERBOSITY=sqlstate',command)
        self.assertIn('--single-transaction',command)
        self.assertIn('-i',command)
        native.assert_called_once()
        self.assertNotIn('--no-owner',native.call_args.args[2])
        self.assertNotIn('--no-privileges',native.call_args.args[2])
        self.assertEqual(path.read_bytes(),original)
        with patch.object(db,'guard'),patch.object(db,'sql',return_value=b'0'),patch.object(r,'decrypt_small') as decrypt,self.assertRaises(r.RestoreError):
            db.restore(self.path,PASSWORD)
        decrypt.assert_not_called()

    def test_role_import_error_prevents_native_database_import_and_hides_private_details(self):
        self.encrypt(self.role_sql(),r.SET_ID+'-roles.sql.enc')
        db=r.Database();db.created=True
        failure=subprocess.CompletedProcess([],3,b'',b'psql:<stdin>:8: ERROR:  42501\nprivate fixture details\n')
        with patch.object(db,'guard'),patch.object(db,'sql',return_value=b'1'),patch.object(r,'run',return_value=failure),patch.object(r,'stream_restore') as native,self.assertRaises(r.RestoreError) as error:
            db.restore(self.path,PASSWORD)
        self.assertEqual(error.exception.code,'RESTORE_ROLES_42501')
        self.assertNotIn('private fixture details',str(error.exception))
        native.assert_not_called()

    def test_effective_metadata_and_both_count_observations_are_required(self):
        ref=reference()
        r.compare_database(ref['before'],ref)
        ref['after']['observed_counts']['users']=2
        with self.assertRaises(r.RestoreError) as error:r.compare_database(ref['before'],ref)
        self.assertEqual(error.exception.code,'RESTORE_COUNTS')
        ref=reference();restored=json.loads(json.dumps(ref['before']))
        restored['objects'][0]['owner_id']='wrong-owner'
        with self.assertRaises(r.RestoreError) as error:r.compare_database(restored,ref)
        self.assertEqual(error.exception.code,'RESTORE_METADATA')
        restored=json.loads(json.dumps(ref['before']));restored['objects'][0]['last_accessed_at']='later'
        r.compare_database(restored,ref)

    def test_real_file_unpack_and_byte_readback(self):
        ref=reference();path=self.archive(ref)
        directory=self.path/'recovered';directory.mkdir()
        self.assertEqual(r.restore_files(GeneratedFiles(directory),path,PASSWORD,ref),1)
        self.assertEqual((directory/ref['file_hashes'][0]['relative_path']).read_bytes(),DATA)

    def test_corrupt_file_bytes_fail_readback(self):
        ref=reference();bad=bytearray(DATA);bad[5]^=1
        path=self.archive(ref,data=bytes(bad));directory=self.path/'recovered';directory.mkdir()
        with self.assertRaises(r.RestoreError) as error:r.restore_files(GeneratedFiles(directory),path,PASSWORD,ref)
        self.assertEqual(error.exception.code,'FILE_READBACK')

    def test_archive_links_traversal_and_duplicates_are_rejected(self):
        for kind in ('link','traversal','duplicate'):
            info=None
            if kind!='duplicate':
                info=tarfile.TarInfo('unexpected-link' if kind=='link' else '../escaped')
                if kind=='link':info.type=tarfile.SYMTYPE;info.linkname='/etc/passwd'
            ref=reference();path=self.archive(ref,extra=info,duplicate=kind=='duplicate')
            directory=self.path/('recovered-'+kind);directory.mkdir()
            with self.subTest(kind=kind),self.assertRaises(r.RestoreError):r.restore_files(GeneratedFiles(directory),path,PASSWORD,ref)
            path.unlink()
            self.assertFalse((self.path/'escaped').exists())

    def test_private_catalog_is_bound_to_original_object_and_safe_path(self):
        import gzip
        ref=reference()
        path=self.encrypt(gzip.compress(r.canonical(ref)),r.SET_ID+'-catalog.json.gz.enc')
        self.assertEqual(r.read_reference(self.path,PASSWORD),ref)
        ref['file_hashes'][0]['relative_path']='../unsafe'
        path.unlink();self.encrypt(gzip.compress(r.canonical(ref)),path.name)
        with self.assertRaises(r.RestoreError):r.read_reference(self.path,PASSWORD)

    def test_backup_anchor_size_hash_sidecars_and_extra_files(self):
        folder=self.path/'backup';folder.mkdir()
        records=[]
        for suffix in r.SUFFIXES:
            name=r.SET_ID+suffix;body=b'Salted__'+suffix.encode()*10
            (folder/name).write_bytes(body)
            digest=hashlib.sha256(body).hexdigest()
            (folder/(name+'.sha256')).write_text(digest+'  '+name+'\n')
            records.append({'filename':name,'size_bytes':len(body),'sha256':digest})
        inventory={'format':'hustle-native-readonly-capture-v1','backup_set_id':r.SET_ID,'source_project_ref':r.PROJECT,'capture_tool_version':'3','archives':records}
        raw=r.canonical(inventory);name=r.SET_ID+'-capture-inventory.json'
        (folder/name).write_bytes(raw)
        digest=hashlib.sha256(raw).hexdigest()
        (folder/(name+'.sha256')).write_text(digest+'  '+name+'\n')
        (folder/'READ_ME.txt').write_text('generated fixture readme')
        with patch.object(r,'INVENTORY_SHA256',digest):
            self.assertEqual(r.verify_backup(folder),inventory)
            extra=folder/'INCOMPLETE_DO_NOT_UPLOAD.txt';extra.write_text('generated failure')
            with self.assertRaises(r.RestoreError):r.verify_backup(folder)
            extra.unlink()
            file=folder/records[0]['filename'];file.write_bytes(b'modified')
            with self.assertRaises(r.RestoreError):r.verify_backup(folder)
        with self.assertRaises(r.RestoreError):r.verify_backup(folder)

    def test_symlink_backup_entries_are_rejected(self):
        path=self.path/'original';path.write_bytes(b'fixture')
        link=self.path/'link';link.symlink_to(path)
        with self.assertRaises(r.RestoreError):r.plain_file(link)

    def inspection(self,db):
        return {'Name':'/'+db.name,'Config':{'Image':r.IMAGE,'User':'postgres','Labels':{r.LABEL:db.token}},
                'Mounts':[{'Type':'tmpfs','Destination':'/tmp'}],
                'HostConfig':{'NetworkMode':'none','ReadonlyRootfs':True,'CapDrop':['ALL'],'Privileged':False,'Binds':None,'PortBindings':{},'Tmpfs':{'/tmp':'rw,size=512m'},'LogConfig':{'Type':'none'},'SecurityOpt':['no-new-privileges']}}

    def test_target_guard_accepts_only_owned_networkless_container(self):
        db=r.Database();obj=self.inspection(db)
        with patch.object(r,'run',return_value=subprocess.CompletedProcess([],0,json.dumps([obj]).encode(),b'')):db.guard()
        for location,key,value in (('HostConfig','NetworkMode','bridge'),('HostConfig','Binds',['/tmp:/host']),('HostConfig','Privileged',True),('HostConfig','ReadonlyRootfs',False),('Config','User','root'),('HostConfig','SecurityOpt',[])):
            altered=json.loads(json.dumps(obj));altered[location][key]=value
            with self.subTest(key=key),patch.object(r,'run',return_value=subprocess.CompletedProcess([],0,json.dumps([altered]).encode(),b'')),self.assertRaises(r.RestoreError):db.guard()
        obj=self.inspection(db);obj['Mounts'].append({'Type':'volume','Destination':'/data'})
        with patch.object(r,'run',return_value=subprocess.CompletedProcess([],0,json.dumps([obj]).encode(),b'')),self.assertRaises(r.RestoreError):db.guard()

    def test_cleanup_refuses_other_ownership_and_requires_deletion(self):
        db=r.Database();db.created=True
        calls=[]
        def wrong(args,**kwargs):
            calls.append(args)
            return subprocess.CompletedProcess([],0,json.dumps({r.LABEL:'other-owner'}).encode(),b'')
        with patch.object(r,'run',side_effect=wrong),self.assertRaises(r.RestoreError):db.cleanup()
        self.assertFalse(any('rm' in cmd for cmd in calls))
        calls=[]
        def good(args,**kwargs):
            calls.append(args)
            if 'inspect' in args and '--format' in args:return subprocess.CompletedProcess([],0,json.dumps({r.LABEL:db.token}).encode(),b'')
            if 'rm' in args:return subprocess.CompletedProcess([],0,b'',b'')
            return subprocess.CompletedProcess([],1,b'',b'Error: No such object')
        with patch.object(r,'run',side_effect=good):db.cleanup()
        self.assertFalse(db.created)
        self.assertIn(['docker','rm','--force','--volumes',db.name],calls)

    def test_unavailable_engine_cannot_be_reported_as_successful_cleanup(self):
        db=r.Database();db.created=True
        with patch.object(r,'run',return_value=subprocess.CompletedProcess([],1,b'',b'Daemon unavailable')),self.assertRaises(r.RestoreError):db.cleanup()
        self.assertTrue(db.created)

    def test_fixture_failures_cleanup_both_owned_targets(self):
        made=[]
        class Failure:
            def __init__(self):self.name='generated';self.cleaned=False;made.append(self)
            def start(self):raise r.RestoreError('GENERATED','fixture start failure')
            def cleanup(self):self.cleaned=True
        with patch.object(r,'Database',Failure),self.assertRaises(r.RestoreError):r.synthetic_contract()
        self.assertEqual(len(made),2)
        self.assertTrue(all(d.cleaned for d in made))

    def complete_fixture(self):
        import gzip
        folder=self.path/'Hustle-Private-Backups'/r.SET_ID
        folder.mkdir(parents=True)
        ref=reference()
        source=self.archive(ref)
        source.rename(folder/(r.SET_ID+'-storage_files.tar.gz.enc'))
        for suffix,plain in (('-roles.sql.enc',b'-- generated global role SQL fixture only\n'*3),
                             ('-database.pgdump.enc',b'PGDMP'+DATA),
                             ('-catalog.json.gz.enc',gzip.compress(r.canonical(ref)))):
            source=self.encrypt(plain,'generated.enc')
            source.rename(folder/(r.SET_ID+suffix))
        records=[]
        for suffix in r.SUFFIXES:
            file=folder/(r.SET_ID+suffix)
            digest=r.hash_file(file)
            records.append({'filename':file.name,'size_bytes':file.stat().st_size,'sha256':digest})
            (folder/(file.name+'.sha256')).write_text(digest+'  '+file.name+'\n')
        inventory={'format':'hustle-native-readonly-capture-v1','backup_set_id':r.SET_ID,'source_project_ref':r.PROJECT,'capture_tool_version':'3','archives':records}
        raw=r.canonical(inventory);digest=hashlib.sha256(raw).hexdigest()
        name=r.SET_ID+'-capture-inventory.json'
        (folder/name).write_bytes(raw)
        (folder/(name+'.sha256')).write_text(digest+'  '+name+'\n')
        (folder/'READ_ME.txt').write_text('generated fixture readme')
        return folder,ref,digest

    def orchestrate(self,*,bad_counts=False,bad_cleanup=False):
        folder,ref,digest=self.complete_fixture()
        original={p.name:p.read_bytes() for p in folder.iterdir()}
        events=[];instances=[];base=self.path
        class Target(GeneratedFiles):
            name='generated-owned-target'
            def __init__(self):
                super().__init__(base/'generated-recovery')
                self.created=False;instances.append(self)
            def start(self):
                self.path.mkdir();self.created=True;events.append('target-started')
            def restore(self,backup,password):
                self.asserted=r.decrypt_small(backup/(r.SET_ID+'-database.pgdump.enc'),password).startswith(b'PGDMP')
                if not self.asserted:raise AssertionError('Native fixture was not imported')
                events.append('native-imported')
            def catalog(self):
                result=json.loads(json.dumps(ref['before']))
                if bad_counts:result['observed_counts']['users']+=1
                return result
            def cleanup(self):
                events.append('cleanup')
                if bad_cleanup:raise r.RestoreError('GENERATED_CLEANUP','generated cleanup failure')
                self.created=False
        def prompt(*args):
            self.assertIn('synthetic-passed',events)
            events.append('private-prompt')
            return PASSWORD
        output=io.StringIO();errors=io.StringIO()
        with patch.object(r,'INVENTORY_SHA256',digest),patch.object(r.Path,'home',return_value=self.path),patch.object(r,'preflight'),patch.object(r,'synthetic_contract',side_effect=lambda:events.append('synthetic-passed')),patch.object(r,'Database',Target),patch.object(r.getpass,'getpass',side_effect=prompt),patch.object(r.sys,'argv',['hustle-restore-test.py']),patch.object(r.signal,'signal'),contextlib.redirect_stdout(output),contextlib.redirect_stderr(errors):
            code=r.main()
        self.assertEqual(original,{p.name:p.read_bytes() for p in folder.iterdir()})
        self.assertNotIn(PASSWORD,output.getvalue()+errors.getvalue())
        self.assertIn('cleanup',events)
        return code,output.getvalue(),errors.getvalue(),instances

    def test_whole_generated_orchestration_writes_private_scoped_report_after_cleanup(self):
        code,out,errors,instances=self.orchestrate()
        self.assertEqual(code,0);self.assertEqual(errors,'')
        self.assertIn('LOCAL DATABASE AND FILE RESTORE CHECK PASSED',out)
        self.assertFalse(any(x.created for x in instances))
        root=self.path/'Hustle-Restore-Checks'
        reports=list(root.iterdir());self.assertEqual(len(reports),1)
        data=json.loads(reports[0].read_bytes())
        self.assertEqual(data['files_recovered_and_rehashed'],1)
        self.assertTrue(data['temporary_containers_removed'])
        self.assertFalse(data['full_disaster_recovery_verified'])
        self.assertFalse(data['auth_signin_tested'])
        self.assertFalse(data['storage_api_access_tested'])
        self.assertEqual(reports[0].stat().st_mode&0o777,0o600)
        self.assertEqual(root.stat().st_mode&0o777,0o700)

    def test_count_failure_cleans_up_and_never_writes_a_passing_report(self):
        code,out,errors,instances=self.orchestrate(bad_counts=True)
        self.assertEqual(code,1);self.assertIn('[RESTORE_COUNTS]',errors)
        self.assertNotIn('CHECK PASSED',out)
        self.assertFalse((self.path/'Hustle-Restore-Checks').exists())
        self.assertFalse(any(x.created for x in instances))

    def test_cleanup_failure_cannot_emit_a_passing_report(self):
        code,out,errors,instances=self.orchestrate(bad_cleanup=True)
        self.assertEqual(code,1);self.assertIn('[CLEANUP]',errors)
        self.assertNotIn('CHECK PASSED',out)
        self.assertFalse((self.path/'Hustle-Restore-Checks').exists())

    def test_self_test_does_not_open_private_backup_or_prompt_for_secret(self):
        with patch.object(r.sys,'argv',['hustle-restore-test.py','--self-test']),patch.object(r,'preflight'),patch.object(r,'synthetic_contract') as contract,patch.object(r,'verify_backup') as verify,patch.object(r.getpass,'getpass') as prompt,patch.object(r.signal,'signal'),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(r.main(),0)
        contract.assert_called_once();verify.assert_not_called();prompt.assert_not_called()

    def test_failed_generated_contract_prevents_private_passphrase_prompt(self):
        with patch.object(r.sys,'argv',['hustle-restore-test.py']),patch.object(r,'preflight'),patch.object(r,'verify_backup'),patch.object(r,'synthetic_contract',side_effect=r.RestoreError('GENERATED','fixture contract failed')),patch.object(r.getpass,'getpass') as prompt,patch.object(r.signal,'signal'),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(r.main(),1)
        prompt.assert_not_called()


if __name__=='__main__':unittest.main()
