#!/usr/bin/env node
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const root=path.resolve(__dirname,"../..");
const original=path.join(root,"apps/api/prisma/migrations");
const tmp="/tmp/hustle-neon-application-projection";
const {projectSql}=require("./neon-prisma-projection.cjs");
const migrations=fs.readdirSync(original,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
function checkLocal(){
  assert.equal(process.env.NODE_ENV,"test");
  const u=new URL(process.env.DATABASE_URL||"invalid:");
  assert.equal(u.protocol,"postgresql:");
  assert.equal(u.hostname,"127.0.0.1");
  assert.equal(u.port,"55441");
  assert.equal(u.username,"postgres");
  assert.equal(u.password,"projection_ci_only");
  assert.equal(u.pathname,"/hustle_neon_projection");
  assert.equal(u.searchParams.get("schema"),"public");
  assert.equal(process.env.PGHOST,"127.0.0.1");
  assert.equal(process.env.PGPORT,"55441");
  assert.equal(process.env.PGDATABASE,"hustle_neon_projection");
  assert.equal(process.env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS,"false");
  assert.equal(process.env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED,"false");
  for(const v of [
    "SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_PUBLISHABLE_KEY",
    "NEON_AUTH_BASE_URL","NEON_AUTH_JWKS_URL","HUSTLE_STAGING_PROJECT_ID",
    "VERCEL_TOKEN","EXPO_TOKEN","PAYSTACK_SECRET_KEY","MONNIFY_API_KEY"
  ])assert.ok(!process.env[v],"External credential not permitted: "+v);
}
function psql(sql){
  return execFileSync("psql",["-v","ON_ERROR_STOP=1","-Atqc",sql],{
    encoding:"utf8",stdio:["ignore","pipe","pipe"]
  }).trim();
}
checkLocal();
assert.equal(migrations.length,41,"Migration history changed and requires review");
for(const name of migrations) {
  const src=fs.readFileSync(path.join(original,name,"migration.sql"),"utf8");
  assert.ok(src.trim());
  const projected=projectSql(name,src);
  assert.doesNotMatch(projected.split("\n").filter(x=>!x.trim().startsWith("--")).join("\n"),
    /\bstorage\.|\bauth\.uid\s*\(|\b(?:anon|authenticated)\b/i,
    "Projected executable SQL must not use Supabase objects: "+name);
}
console.log("PASS: audited 41 migration projections; no Storage/Auth mocks or Supabase database roles");
if(process.argv[2]==="verify"){
  const audit=JSON.parse(fs.readFileSync(path.join(tmp,"projection-audit.json"),"utf8"));
  assert.equal(audit.total,41);
  assert.equal(audit.retainedManagedAuth,true);
  assert.equal(audit.createdApplicationRoleLogin,false);
  assert.equal(psql("SELECT current_database()"),"hustle_neon_projection");
  assert.equal(Number(psql("SELECT current_setting('server_version_num')"))>=170000,true);
  assert.equal(Number(psql("SELECT count(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")),41);
  const tables=psql("SELECT string_agg(table_name,',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'").split(",");
  assert.ok(tables.length>=60,"Application schema must retain full table set");
  for(const name of ["_prisma_migrations","User","UserCapability","ProfessionalProfile",
    "Service","Product","Post","Story","StoryView","StoryReply","AgentApplication",
    "Booking","BookingScheduleRevision","PaymentAttempt","EscrowRecord","SystemEvent"]){
    assert.ok(tables.includes(name),"Missing application table: "+name);
  }
  for(const name of ["User","Booking","PaymentAttempt","EscrowRecord","SystemEvent"]){
    assert.equal(psql('SELECT count(*) FROM public."'+name+'"'),"0");
  }
  assert.equal(psql('SELECT count(*) FROM neon_auth."user"'),"1");
  assert.equal(psql("SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='neon_auth')"),"2");
  for(const name of ["anon","authenticated"]){
    assert.equal(psql("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='"+name+"')"),"f");
  }
  assert.equal(psql("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='hustle_api' AND rolcanlogin=false)"),"t");
  assert.equal(psql("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='storage')"),"f");
  assert.equal(psql("SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name='auth')"),"f");
  assert.equal(psql("SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname LIKE '%story%'")>0,true);
  // The only trusted application role is NOLOGIN; test a separate unprivileged
  // role to ensure application users are not directly queryable.
  psql("CREATE ROLE ci_untrusted NOLOGIN");
  assert.throws(()=>psql('SET ROLE ci_untrusted; SELECT id FROM public."User" LIMIT 1'),
    /permission denied/);
  console.log("PASS: "+tables.length+" app tables, all 41 migrations, no Supabase mocks or public auth access, Neon Auth fixture unchanged");
  console.log("BOUNDARY: isolated CI PostgreSQL 17 only; no hosted Neon schema write");
}else if(process.argv[2]==="preflight"){
  console.log("PASS: local-only PG17 staging projection guard");
}else{
  throw Error("Only preflight or verify are supported");
}
