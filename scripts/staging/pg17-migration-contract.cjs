#!/usr/bin/env node
"use strict";
/**
 * Real Prisma migration readiness against a disposable, LOCAL PostgreSQL 17.
 * Never connects to hosted Neon or Supabase. Two fictional auth tables
 * approximate a pre-existing managed schema, NOT real Better Auth acceptance.
 */
const assert=require("node:assert/strict");
const {readdirSync,readFileSync}=require("node:fs");
const {resolve,join}=require("node:path");
const {execFileSync}=require("node:child_process");

function ensureIsolated() {
  assert.equal(process.env.NODE_ENV,"test");
  const url = new URL(process.env.DATABASE_URL||"invalid:");
  assert.equal(url.protocol,"postgresql:");
  assert.equal(url.hostname,"127.0.0.1");
  assert.equal(url.port,"55440");
  assert.equal(url.username,"postgres");
  assert.equal(url.password,"pg17_ci_only");
  assert.equal(url.pathname,"/hustle_payment_sandbox");
  assert.equal(url.searchParams.get("schema"),"public");
  assert.equal(process.env.PGHOST,"127.0.0.1");
  assert.equal(process.env.PGPORT,"55440");
  assert.equal(process.env.PGUSER,"postgres");
  assert.equal(process.env.PGDATABASE,"hustle_payment_sandbox");
  for(const key of [
    "SUPABASE_URL","SUPABASE_PUBLISHABLE_KEY","SUPABASE_SERVICE_ROLE_KEY",
    "HUSTLE_STAGING_PROJECT_ID","NEON_AUTH_BASE_URL","NEON_AUTH_JWKS_URL",
    "VERCEL_TOKEN","EXPO_TOKEN","PAYSTACK_SECRET_KEY","MONNIFY_API_KEY"
  ]) assert.ok(!process.env[key],"No external provider credentials: "+key);
}
function query(sql){
  return execFileSync("psql",["-v","ON_ERROR_STOP=1","-Atqc",sql],
    {encoding:"utf8"}).trim();
}
const migrationRoot=resolve(process.cwd(),"apps/api/prisma/migrations");
const dirs=readdirSync(migrationRoot,{withFileTypes:true}).filter(x=>x.isDirectory()).map(x=>x.name).sort();
function migrationAudit(){
  assert.ok(dirs.length>=35,"Expected existing Prisma migration ledger");
  assert.ok(dirs.includes("20260917130500_phase16b_story_rls_hardening"));
  assert.ok(dirs.includes("20261015122500_flowtime_adaptive_booking"));
  let supabaseMentions=0,roleMentions=0,storageMentions=0;
  for(const d of dirs){
    const sql=readFileSync(join(migrationRoot,d,"migration.sql"),"utf8");
    assert.ok(sql.trim(),"Migration must not be empty: "+d);
    if(/\bauth\.|\banon\b|\bauthenticated\b/.test(sql))supabaseMentions++;
    if(/\bhustle_api\b|\bCREATE ROLE\b|\bGRANT\b/.test(sql))roleMentions++;
    if(/\bstorage\./.test(sql))storageMentions++;
  }
  assert.ok(supabaseMentions>0,"Supabase-specific migration dependencies must remain visible");
  assert.ok(roleMentions>0,"API role/security migration must remain visible");
  assert.ok(storageMentions>0,"Existing Storage DDL dependencies must remain visible");
  console.log("PASS: audited "+dirs.length+" original migrations; recorded Supabase role/storage compatibility blockers");
}
ensureIsolated();
migrationAudit();
if(process.argv[2]==="preflight"){
  console.log("PASS: localhost-only PG17 preflight; external DB and credentials forbidden");
}else if(process.argv[2]==="verify"){
  assert.ok(Number(query("SELECT current_setting('server_version_num')"))>=170000);
  assert.equal(query("SELECT current_database()"),"hustle_payment_sandbox");
  const finished=Number(query("SELECT COUNT(*) FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL"));
  assert.equal(finished,dirs.length,"Exact source migration count must match successful ledger");
  const names=query("SELECT string_agg(table_name,',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'").split(",");
  for(const expected of ["User","UserCapability","Service","Product","Post","Booking","PaymentAttempt","EscrowRecord","SystemEvent","_prisma_migrations"]){
    assert.ok(names.includes(expected),"Expected table missing: "+expected);
  }
  for(const table of ["User","Booking","PaymentAttempt","EscrowRecord","SystemEvent"]){
    assert.equal(query('SELECT COUNT(*) FROM public."'+table+'"'),"0",table+" must remain empty");
  }
  assert.equal(query('SELECT COUNT(*) FROM neon_auth."user"'),"1");
  for(const role of ["hustle_api","anon","authenticated"]){
    assert.equal(query("SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='"+role+"')"),"t");
  }
  console.log("PASS: PG17 applied all "+dirs.length+" actual Prisma migrations; "+
    names.length+" public tables; auth fixture preserved; no user/payment/booking/escrow/event records");
  console.log("LIMIT: PASS is local-only and does not authorize hosted Neon migrations");
}else{
  throw Error("Expected preflight or verify");
}
