import contextlib
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import uuid

spec=importlib.util.spec_from_file_location('access',Path(__file__).with_name('hustle-access-recovery-test.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)


def token(secret,user_id,**changes):
    claims={'iss':a.ISSUER,'role':'authenticated','sub':user_id,'aud':'authenticated',
            'iat':int(time.time()),'exp':int(time.time())+3600,'session_id':str(uuid.uuid4())}
    claims.update(changes)
    first=a.b64(a.core.canonical({'alg':'HS256','typ':'JWT'}))+'.'+a.b64(a.core.canonical(claims))
    return first+'.'+a.b64(a.hmac.new(secret.encode(),first.encode(),hashlib.sha256).digest())


class AccessTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)
    def tearDown(self):self.temp.cleanup()

    def test_verified_core_tampering_is_rejected_before_any_import(self):
        p=self.path/a.CORE_NAME;p.write_bytes(b'raise RuntimeError("must never run")')
        with patch.object(a,'__file__',str(self.path/'hustle-access-recovery-test.py')),self.assertRaises(RuntimeError):a.load_core()

    def test_signed_user_tokens_require_restored_identity_normal_role_new_key_and_session(self):
        secret=secrets.token_urlsafe(48);uid=str(uuid.uuid4())
        jwt=token(secret,uid)
        self.assertEqual(a.validate_user_token(jwt,secret,uid)['sub'],uid)
        for bad in (token('different-key',uid),token(secret,str(uuid.uuid4())),token(secret,uid,role='service_role'),
                    token(secret,uid,iss='https://production.invalid'),token(secret,uid,exp=1),token(secret,uid,aud='service_role'),
                    token(secret,uid,session_id=''),token(secret,uid,iat=int(time.time())+600)):
            with self.subTest(bad=bad[:12]),self.assertRaises(a.RestoreError):a.validate_user_token(bad,secret,uid)

    def test_uri_builder_and_backend_map_preserve_object_identity_and_reject_traversal(self):
        record={'bucket_id':'hustler-proofs','name':str(uuid.uuid4())+'/proof #é.pdf','version':str(uuid.uuid4()),
                'size_bytes':4,'sha256':hashlib.sha256(b'file').hexdigest()}
        path=a.storage_path(record)
        self.assertIn('proof%20%23%C3%A9.pdf',path)
        header=a.backend_header(record,{'metadata':{'mimetype':'application/pdf','cacheControl':'max-age=3600'}})
        self.assertEqual(header['name'],record['name']);self.assertEqual(header['version'],record['version'])
        self.assertEqual(header['mimetype'],'application/pdf');self.assertEqual(header['size'],4)
        for key,value in (('bucket_id','a/b'),('name','../outside'),('name','x//file'),('name','x\\file'),
                          ('name','x\x00file'),('version','../escaped')):
            bad=dict(record);bad[key]=value
            with self.subTest(key=key,value=value),self.assertRaises(a.RestoreError):a.backend_header(bad,{})

    def test_owner_selection_uses_private_proof_policy_path_and_not_owner_metadata_alone(self):
        uid=str(uuid.uuid4());other=str(uuid.uuid4())
        records=[{'bucket_id':'hustler-proofs','name':uid+'/proof.pdf'},
                 {'bucket_id':'agent-proofs','name':uid+'/proof.pdf'},
                 {'bucket_id':'hustler-proofs','name':other+'/proof.pdf','owner_id':uid},
                 {'bucket_id':'message-attachments','name':'chat/'+uid+'/proof.pdf'}]
        ref={'before':{'buckets':[{'id':'hustler-proofs','public':False},{'id':'agent-proofs','public':True}]},'file_hashes':records}
        self.assertEqual(a.private_proofs(ref,uid),records[:1])

    def test_database_network_change_is_scoped_and_core_boot_is_restored_on_failure(self):
        original=a.core.BOOT;observed=[]
        def failure(db):
            observed.append(a.core.BOOT)
            raise a.RestoreError('GENERATED','generated failure')
        with patch.object(a.core.Database,'start',failure),self.assertRaises(a.RestoreError):a.ApiDatabase().start()
        self.assertEqual(a.core.BOOT,original)
        self.assertIn('-c listen_addresses=127.0.0.1 ',observed[0])
        self.assertIn('max_connections=30',observed[0])
        self.assertEqual(observed[0].replace('-c listen_addresses=127.0.0.1 ','-c listen_addresses= ').replace('max_connections=30','max_connections=10'),original)

    def test_service_environments_only_use_new_local_keys_and_auth_real_restore_skips_migrations(self):
        stack=a.Stack();made=[]
        class FakeService:
            def __init__(self,db,kind,values,**kw):self.kind=kind;self.values=values;self.options=kw;made.append(self)
            def start(self):pass
        with patch.object(a,'Service',FakeService),patch.object(stack,'wait'):stack.services()
        auth,storage=made
        self.assertIs(auth.options['migrate'],False)
        self.assertEqual(auth.values['GOTRUE_JWT_SECRET'],stack.secret)
        self.assertEqual(storage.values['AUTH_JWT_SECRET'],stack.secret)
        self.assertEqual(storage.values['DB_MIGRATIONS_FREEZE_AT'],a.STORAGE_MIGRATION)
        self.assertEqual(storage.values['DB_ALLOW_MIGRATION_REFRESH'],'false')
        self.assertEqual(storage.values['PG_QUEUE_ENABLE'],'false')
        self.assertEqual(storage.values['SERVER_HOST'],'127.0.0.1')
        for record in made:
            for key,val in record.values.items():
                self.assertNotIn('supabase.co',val)
                self.assertNotIn(a.core.PROJECT,val)
        self.assertNotIn('JWT_JWKS',storage.values)

    def inspection(self,service):
        return {'Name':'/'+service.name,'Config':{'Image':service.image,'User':'1000:1000',
                'Labels':{a.core.LABEL:service.token},'Env':[k+'='+v for k,v in service.values.items()]},
                'Mounts':[{'Type':'tmpfs','Destination':'/tmp'}],
                'HostConfig':{'NetworkMode':'container:'+service.database.name,'ReadonlyRootfs':True,'CapDrop':['ALL'],
                             'Privileged':False,'Binds':None,'PortBindings':{},'Tmpfs':{'/tmp':'rw'},
                             'LogConfig':{'Type':'none'},'SecurityOpt':['no-new-privileges']}}

    def test_service_guard_rejects_network_mount_key_and_ownership_changes(self):
        db=a.ApiDatabase();db.created=True;db.container_id='a'*64
        service=a.Service(db,'storage',{'AUTH_JWT_SECRET':'generated-key'})
        obj=self.inspection(service)
        with patch.object(db,'guard'),patch.object(a.core,'run',return_value=subprocess.CompletedProcess([],0,json.dumps([obj]).encode(),b'')):service.guard()
        for section,key,value in (('HostConfig','NetworkMode','bridge'),('HostConfig','NetworkMode','container:someone-else'),
                                  ('HostConfig','Binds',['/host:/tmp']),('HostConfig','PortBindings',{'5000/tcp':[{'HostPort':'5000'}]}),
                                  ('HostConfig','Privileged',True),('HostConfig','ReadonlyRootfs',False),
                                  ('Config','User','root'),('Config','Env',['AUTH_JWT_SECRET=other'])):
            bad=json.loads(json.dumps(obj));bad[section][key]=value
            with self.subTest(key=key),patch.object(db,'guard'),patch.object(a.core,'run',return_value=subprocess.CompletedProcess([],0,json.dumps([bad]).encode(),b'')),self.assertRaises(a.RestoreError):service.guard()

    def test_docker_create_never_puts_local_secrets_in_arguments(self):
        db=a.ApiDatabase();db.created=True;db.container_id='a'*64
        service=a.Service(db,'auth',{'GOTRUE_JWT_SECRET':'generated-fixture-secret'})
        seen=[]
        def create(args,**kw):seen.append((args,kw));return subprocess.CompletedProcess(args,0,b'id',b'')
        with patch.object(db,'guard'),patch.object(service,'guard'),patch.object(a,'private_run',side_effect=create),patch.object(a.core,'run'):service.start()
        args,options=seen[0]
        self.assertNotIn('generated-fixture-secret',' '.join(args))
        self.assertEqual(options['values']['GOTRUE_JWT_SECRET'],'generated-fixture-secret')
        self.assertIn('container:'+db.name,args);self.assertIn('--read-only',args)
        self.assertIn('/usr/local/bin/auth serve',args[-1])
        self.assertIn('/tmp/startup-private.log',args[-1])

    def test_policy_denial_rejects_invalid_tokens_server_errors_and_wrong_file_digests(self):
        for response in ({'status':400,'json':{'code':'NoSuchKey'}},{'status':404,'json':{'code':'NoSuchBucket'}}):a.assert_denied(response)
        for response in ({'status':200,'json':{}},{'status':500,'json':{'code':'NoSuchKey'}},
                         {'status':401,'json':{'code':'InvalidJWT'}},{'status':400,'json':{'message':'unknown'}}):
            with self.assertRaises(a.RestoreError):a.assert_denied(response)
        record={'size_bytes':4,'sha256':hashlib.sha256(b'file').hexdigest()}
        a.assert_bytes({'status':200,'size':4,'sha256':record['sha256']},record)
        with self.assertRaises(a.RestoreError):a.assert_bytes({'status':200,'size':4,'sha256':'0'*64},record)

    def test_access_assertions_use_user_tokens_and_include_anon_and_public_route(self):
        uid=str(uuid.uuid4());data=b'generated'
        record={'bucket_id':'hustler-proofs','name':uid+'/proof.txt','size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        reference={'before':{'buckets':[{'id':'hustler-proofs','public':False}]},'file_hashes':[record]}
        stack=a.Stack();seen=[]
        def request(kind,path,**kwargs):
            seen.append((path,kwargs.get('token')))
            if kwargs.get('token') in (stack.service_token,'owner-token'):
                return {'status':200,'size':len(data),'sha256':record['sha256']}
            return {'status':400,'json':{'code':'NoSuchKey'}}
        with patch.object(stack,'request',side_effect=request):self.assertEqual(a.exercise_access(stack,reference,'owner-token','other-token',[record]),(1,0))
        self.assertEqual(len(seen),5)
        self.assertEqual([x[1] for x in seen],[stack.service_token,'owner-token','other-token',stack.anon_token,None])
        self.assertIn('/public/',seen[-1][0])

    def node(self,script,data):
        return subprocess.run(['node','-e',script],input=data,capture_output=True,timeout=20)

    def test_node_http_worker_hashes_bytes_without_outputting_them_or_following_redirects(self):
        payload=b'Generated private bytes should stay inside the worker.'*1000
        seen=[]
        class Handler(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_GET(self):
                seen.append(self.path)
                if self.path=='/redirect':
                    self.send_response(302);self.send_header('Location','http://production.invalid/never');self.end_headers();return
                self.send_response(200);self.end_headers();self.wfile.write(payload)
        server=ThreadingHTTPServer(('127.0.0.1',5000),Handler)
        thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            result=self.node(a.HTTP_WORKER,a.core.canonical({'service':'storage','method':'GET','path':'/object/generated','digest':True}))
            self.assertEqual(result.returncode,0,result.stderr)
            out=json.loads(result.stdout)
            self.assertEqual(out['sha256'],hashlib.sha256(payload).hexdigest());self.assertEqual(out['size'],len(payload))
            self.assertNotIn(payload[:40],result.stdout)
            result=self.node(a.HTTP_WORKER,a.core.canonical({'service':'storage','method':'GET','path':'/redirect','digest':True}))
            self.assertEqual(json.loads(result.stdout)['status'],302)
            self.assertEqual(seen,['/object/generated','/redirect'])
        finally:server.shutdown();server.server_close();thread.join()

    def test_node_worker_rejects_external_services_and_header_injection(self):
        for changes in ({'service':'https://production.invalid'},{'method':'DELETE'},{'path':'//production.invalid/x'},
                        {'path':'/x\r\nHost: production.invalid'},{'path':'/x\\evil'}):
            request={'service':'storage','method':'GET','path':'/status'};request.update(changes)
            result=self.node(a.HTTP_WORKER,a.core.canonical(request))
            self.assertEqual(result.returncode,2);self.assertEqual(result.stdout,b'')

    def test_node_file_adapter_streams_hash_checks_and_passes_original_version_to_backend(self):
        payload=b'Generated adapter file bytes.'*10000
        uid=str(uuid.uuid4())
        record={'bucket_id':'hustler-proofs','name':uid+'/proof.txt','version':str(uuid.uuid4()),
                'size_bytes':len(payload),'sha256':hashlib.sha256(payload).hexdigest()}
        header=a.backend_header(record,{'metadata':{'mimetype':'text/plain','cacheControl':'max-age=3600'}})
        stub=r'''
const Module=require('module'); const original=Module._load; const fs=require('fs');
Module._load=function(name,...rest) {
 if(name!=='/app/dist/storage/backend/file.js')return original.call(this,name,...rest);
 return {FileBackend:class {
  async uploadObject(root,key,version,stream,mimetype,cacheControl,signal,size,contentEncoding) {
   let parts=[];for await(const part of stream)parts.push(part);
   fs.writeFileSync(TARGET,Buffer.concat(parts));
   fs.writeFileSync(TARGET+'.json',JSON.stringify({root,key,version,mimetype,cacheControl,size}));
  }
 }};
};
'''.replace('TARGET',json.dumps(str(self.path/'received')))
        result=self.node(stub+a.FILE_WORKER,a.core.canonical(header)+b'\n'+payload)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual((self.path/'received').read_bytes(),payload)
        meta=json.loads((self.path/'received.json').read_text())
        self.assertEqual(meta['version'],record['version']);self.assertEqual(meta['key'],a.TENANT+'/'+record['bucket_id']+'/'+record['name'])
        self.assertEqual(json.loads(result.stdout),{'size':len(payload),'sha256':record['sha256']})
        bad=dict(header);bad['sha256']='0'*64
        result=self.node(stub+a.FILE_WORKER,a.core.canonical(bad)+b'\n'+payload)
        self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
        for name in ('../escaped','nested/../../escaped','x\\escaped'):
            bad=dict(header);bad['name']=name
            result=self.node(stub+a.FILE_WORKER,a.core.canonical(bad)+b'\n'+payload)
            self.assertNotEqual(result.returncode,0)

    def test_account_lookup_hides_email_from_command_arguments_and_rejects_missing_mfa_accounts(self):
        stack=a.Stack();uid=str(uuid.uuid4())
        seen=[]
        def query(db,sql):
            seen.append(sql)
            return json.dumps({'id':uid,'confirmed':True,'has_password':True,'banned':False,'mfa':False}).encode()
        with patch.object(a,'private_sql',side_effect=query):self.assertEqual(a.account_info(stack,"owner'quote@hustle.invalid"),uid)
        self.assertIn("owner''quote@hustle.invalid",seen[0])
        with patch.object(a,'private_sql',return_value=b'null'),self.assertRaises(a.RestoreError):a.account_info(stack,'missing@hustle.invalid')
        with patch.object(a,'private_sql',return_value=json.dumps({'id':uid,'confirmed':True,'has_password':True,'banned':False,'mfa':True}).encode()),self.assertRaises(a.RestoreError) as error:a.account_info(stack,'mfa@hustle.invalid')
        self.assertEqual(error.exception.code,'MFA_SEPARATE')

    def test_password_login_and_refresh_must_both_match_original_user(self):
        stack=a.Stack();uid=str(uuid.uuid4());jwt=token(stack.secret,uid)
        good=[{'status':200,'json':{'access_token':jwt,'refresh_token':'generated-refresh'}},
              {'status':200,'json':{'id':uid}},
              {'status':200,'json':{'access_token':jwt,'refresh_token':'generated-next-refresh'}},
              {'status':200,'json':{'id':uid}}]
        with patch.object(stack,'request',side_effect=good) as request:
            self.assertEqual(stack.login('owner@hustle.invalid','generated-password',uid),jwt)
        self.assertEqual(request.call_args_list[0].args[1],'/token?grant_type=password')
        self.assertEqual(request.call_args_list[2].args[1],'/token?grant_type=refresh_token')
        bad=good[:2]+[{'status':400,'json':{'private':'hidden'}}]
        with patch.object(stack,'request',side_effect=bad),self.assertRaises(a.RestoreError) as error:stack.login('owner@hustle.invalid','generated-password',uid)
        self.assertEqual(error.exception.code,'LOCAL_REFRESH');self.assertNotIn('hidden',str(error.exception))

    def test_prior_report_requires_exact_independent_digest(self):
        root=self.path/'Hustle-Restore-Checks';root.mkdir()
        record={'backup_set_id':a.core.SET_ID,'inventory_sha256':a.core.INVENTORY_SHA256,
                'native_database_and_roles_imported_without_ignored_errors':True,'storage_metadata_matches_ignoring_access_bookkeeping':True,
                'files_recovered_and_rehashed':10,'temporary_containers_removed':True}
        raw=a.core.canonical(record);p=root/a.REPORT_NAME;p.write_bytes(raw)
        with patch.object(a.Path,'home',return_value=self.path),patch.object(a,'REPORT_SHA256',hashlib.sha256(raw).hexdigest()):a.verify_report()
        p.write_bytes(raw+b' ')
        with patch.object(a.Path,'home',return_value=self.path),self.assertRaises(a.RestoreError):a.verify_report()

    def test_failed_generated_api_contract_prevents_private_passphrase_or_account_prompt(self):
        with patch.object(a.sys,'argv',['hustle-access-recovery-test.py']),patch.object(a,'verify_report'),patch.object(a.core,'verify_backup'),patch.object(a,'preflight'),patch.object(a,'generated_contract',side_effect=a.RestoreError('API_FIXTURE','generated failed')),patch.object(a.getpass,'getpass') as prompt,patch.object(a.signal,'signal'),contextlib.redirect_stdout(io.StringIO()),contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(a.main(),1)
        prompt.assert_not_called()

    def test_selftest_never_opens_private_backup_report_or_prompt(self):
        with patch.object(a.sys,'argv',['hustle-access-recovery-test.py','--self-test']),patch.object(a,'verify_report') as report,patch.object(a.core,'verify_backup') as backup,patch.object(a,'preflight'),patch.object(a,'generated_contract'),patch.object(a.getpass,'getpass') as prompt,patch.object(a.signal,'signal'),contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(a.main(),0)
        report.assert_not_called();backup.assert_not_called();prompt.assert_not_called()

    def orchestrate(self,*,access_error=False,cleanup_error=False):
        uid=str(uuid.uuid4());other=str(uuid.uuid4());events=[];instances=[]
        data=b'generated';record={'bucket_id':'hustler-proofs','name':uid+'/proof.txt','object_id':str(uuid.uuid4()),
            'version':str(uuid.uuid4()),'relative_path':'objects/'+'f'*64,'size_bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
        ref={'before':{'observed_counts':{'users':6},'buckets':[{'id':'hustler-proofs','public':False}],
                       'objects':[{'id':record['object_id'],'bucket_id':record['bucket_id'],'name':record['name']}]},'file_hashes':[record]}
        ref['after']=json.loads(json.dumps(ref['before']))
        class Database:
            def restore(self,*args):events.append('restored')
            def catalog(self):return ref['before']
        class Stack:
            service_token='generated-admin';secret='generated-only'
            def __init__(self):self.database=Database();self.created=True;instances.append(self)
            def start_database(self):events.append('database')
            def services(self):events.append('apis')
            def cleanup(self):
                events.append('cleanup')
                if cleanup_error:raise a.RestoreError('CLEANUP','generated cleanup failure')
                self.created=False
            def request(self,*args,**kwargs):return {'status':200,'size':len(data),'sha256':record['sha256']}
            def create_generated_account(self):return {'id':other,'email':'generated@hustle.invalid','password':'generated-only'}
            def login(self,*args):events.append('login');return 'generated-local-token'
        root=self.path/'Hustle-Restore-Checks';root.mkdir()
        prompts=iter(['generated-encryption-passphrase','owner@hustle.invalid','generated-account-password'])
        def prompt(*args):
            self.assertIn('synthetic',events);return next(prompts)
        def exercise(*args):
            events.append('access-checked')
            if access_error:raise a.RestoreError('LOCAL_STORAGE_DENIAL','generated failure')
            return 1,0
        out,err=io.StringIO(),io.StringIO()
        with patch.object(a.sys,'argv',['hustle-access-recovery-test.py']),patch.object(a.Path,'home',return_value=self.path),patch.object(a,'verify_report'),patch.object(a.core,'verify_backup'),patch.object(a,'preflight'),patch.object(a,'generated_contract',side_effect=lambda:events.append('synthetic')),patch.object(a,'Stack',Stack),patch.object(a.getpass,'getpass',side_effect=prompt),patch.object(a.core,'read_reference',return_value=ref),patch.object(a.core,'restore_files',return_value=10),patch.object(a,'private_sql',return_value=b'generated-schema'),patch.object(a,'stage_backend'),patch.object(a,'account_info',return_value=uid),patch.object(a,'exercise_access',side_effect=exercise),patch.object(a.signal,'signal'),contextlib.redirect_stdout(out),contextlib.redirect_stderr(err):
            result=a.main()
        self.assertNotIn('generated-account-password',out.getvalue()+err.getvalue())
        return result,out.getvalue(),err.getvalue(),root,events,instances

    def test_passing_orchestration_writes_scoped_private_report_only_after_cleanup(self):
        result,out,err,root,events,instances=self.orchestrate()
        self.assertEqual(result,0,err);self.assertIn('REHEARSAL PASSED',out)
        self.assertFalse(any(s.created for s in instances));self.assertIn('access-checked',events)
        reports=list(root.glob('*.json'));self.assertEqual(len(reports),1)
        report=json.loads(reports[0].read_bytes())
        self.assertEqual(report['restored_password_accounts_signed_in'],1)
        self.assertEqual(report['unrelated_identity'],'generated_local_auth_account')
        self.assertFalse(report['full_disaster_recovery_verified']);self.assertFalse(report['mfa_tested'])
        self.assertFalse(report['message_participant_access_tested'])
        self.assertFalse(report['production_accessed'])
        self.assertEqual(reports[0].stat().st_mode&0o777,0o600)
        self.assertEqual(root.stat().st_mode&0o777,0o700)

    def test_denial_failure_never_emits_success_or_a_passing_report(self):
        result,out,err,root,events,instances=self.orchestrate(access_error=True)
        self.assertEqual(result,1);self.assertIn('[LOCAL_STORAGE_DENIAL]',err)
        self.assertNotIn('REHEARSAL PASSED',out);self.assertFalse(list(root.glob('*.json')))
        self.assertFalse(any(s.created for s in instances))

    def test_cleanup_failure_never_emits_success_or_a_passing_report(self):
        result,out,err,root,events,instances=self.orchestrate(cleanup_error=True)
        self.assertEqual(result,1);self.assertIn('[CLEANUP]',err)
        self.assertNotIn('REHEARSAL PASSED',out);self.assertFalse(list(root.glob('*.json')))

    def test_generated_source_failure_cleans_both_targets(self):
        instances=[]
        class FailStack:
            def __init__(self):self.cleaned=False;instances.append(self)
            def start_database(self):raise a.RestoreError('GENERATED','generated failure')
            def cleanup(self):self.cleaned=True
        with patch.object(a,'Stack',FailStack),self.assertRaises(a.RestoreError):a.generated_contract()
        self.assertEqual(len(instances),2);self.assertTrue(all(s.cleaned for s in instances))

    def test_startup_diagnostics_expose_only_fixed_categories(self):
        db=a.ApiDatabase();db.created=True;db.container_id='a'*64
        service=a.Service(db,'storage',{})
        service.created=True
        for value in (b'',b'MIGRATION_CONTRACT',b'DATABASE_PRIVILEGE',b'IMAGE_MODULE',b'CONFIGURATION'):
            with patch.object(a.core,'run',return_value=subprocess.CompletedProcess([],0,value,b'')):
                self.assertEqual(service.stopped_category(),value.decode())
        with patch.object(a.core,'run',return_value=subprocess.CompletedProcess([],0,b'private server details',b'')),self.assertRaises(a.RestoreError):service.stopped_category()


if __name__=='__main__':unittest.main()
