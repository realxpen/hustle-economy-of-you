import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import {validateMigrationTarget,project,branch,host} from "./migrate.mjs";

const url="postgresql://hustle_payment_preview_owner:ONLY_FAKE_PASSWORD_123456@"+host+"/hustle_payment_preview?sslmode=require&schema=public";
assert.equal(validateMigrationTarget(url).hostname,host);
const pooler = "ep-holy-block-zauxat1w-pooler.c-2.eu-west-2.aws.neon.tech";
for (const sample of [
  url,
  url.replace(host,pooler),
  url.replace(host,pooler).replace("sslmode=require&schema=public","sslmode=require&channel_binding=require"),
  url.replace("?sslmode=require&schema=public","?sslmode=require"),
  url.replace("schema=public","channel_binding=require")
]) {
  const u=validateMigrationTarget(sample);
  assert.equal(u.hostname,host,"Prisma and psql must NEVER use the pooler");
  assert.equal(u.username,"hustle_payment_preview_owner");
  assert.equal(u.pathname,"/hustle_payment_preview");
  assert.equal(u.search,"?sslmode=require&schema=public");
}
for(const [bad,reason] of [
  [undefined,/malformed/], ["",/malformed/],
  [url.replace("postgresql:","http:"),/postgresql/],
  [url.replace("hustle_payment_preview_owner","hustle_payment_preview_api"),/owner role/],
  [url.replace("/hustle_payment_preview?","/staging?"),/database/],
  [url.replace(host,"ep-cold-smoke-za8u3vsm.c-2.eu-west-2.aws.neon.tech"),/endpoint/],
  [url.replace("sslmode=require","sslmode=disable"),/TLS/],
  [url.replace("schema=public","schema=payment_auth"),/schema/],
  [url+"&channel_binding=disable",/TLS/],
  [url+"&sslmode=require",/duplicate/],
  [url+"&connect_timeout=20",/unsupported/],
  [url+"&user=hustle_payment_preview_owner",/user override|unsupported/],
  [url.replace("ONLY_FAKE_PASSWORD_123456","bad"),/password/],
  ["psql '"+url+"'",/malformed/]
]) {
  assert.throws(()=>validateMigrationTarget(bad),reason);
}

assert.equal(project,"fragrant-field-59689896");
assert.equal(branch,"br-curly-leaf-zat0ec8m");

const sql=fs.readFileSync("scripts/payment-preview/neon-compat.sql","utf8");
const preflight=fs.readFileSync("scripts/payment-preview/preflight.sql","utf8");
const final=fs.readFileSync("scripts/payment-preview/grants-and-check.sql","utf8");
const workflow=fs.readFileSync(".github/workflows/hustle-payment-preview-neon-schema.yml","utf8");
for(const required of ["hustle_payment_preview","hustle_payment_preview_owner","server_version_num","pg_catalog.pg_tables"])
  assert.ok(preflight.includes(required),"missing DB-empty guard: "+required);
for(const required of ["CREATE ROLE anon NOLOGIN","CREATE ROLE authenticated NOLOGIN","storage.objects","auth.uid()","ENABLE ROW LEVEL SECURITY"])
  assert.ok(sql.includes(required),"missing synthetic migration compat fixture: "+required);
for(const required of ["ALTER ROLE hustle_api NOLOGIN","GRANT hustle_api TO hustle_payment_preview_api","payment_auth","pg_has_role","rolcanlogin"])
  assert.ok(final.includes(required),"missing role isolation check: "+required);
for(const required of ["workflow_dispatch","hustle-payment-preview-api","I_AUTHORIZE_ISOLATED_TEST_SCHEMA_ONLY",project,branch,"HUSTLE_PREVIEW_NEON_OWNER_URL","node scripts/payment-preview/migrate.mjs"])
  assert.ok(workflow.includes(required),"missing protected workflow guard: "+required);
assert.doesNotMatch(workflow,/^  (push|pull_request|schedule):/m);
assert.doesNotMatch(workflow,/wrangler deploy|cloudformation deploy|paystack\.com|prod-staging-database/);

for(const envPatch of [
  {}, {GITHUB_REPOSITORY:"wrong/repo"},
  {HUSTLE_NEON_BRANCH_ID:"br-dark-sunset-zay33p1s"},
  {HUSTLE_PREVIEW_SCHEMA_APPROVAL:"DO_NOT_APPLY"},
  {PAYSTACK_TEST_SECRET_KEY:"test_secret"}
]) {
  const safeEnv={...process.env,GITHUB_REPOSITORY:"realxpen/hustle-economy-of-you",
    GITHUB_REF:"refs/heads/main",HUSTLE_NEON_PROJECT_ID:project,HUSTLE_NEON_BRANCH_ID:branch,
    HUSTLE_PREVIEW_SCHEMA_APPROVAL:"I_AUTHORIZE_ISOLATED_TEST_SCHEMA_ONLY",
    HUSTLE_PREVIEW_MIGRATION_URL:"",...envPatch};
  const x=spawnSync(process.execPath,["scripts/payment-preview/migrate.mjs"],
    {env:safeEnv,encoding:"utf8",timeout:4000});
  assert.notEqual(x.status,0,"migration runner MUST fail before network when no protected owner URL");
  assert.match(x.stderr,/REFUSED/);
}
console.log("PASS: Neon owner URL normalized to exact direct host; wrong role, host, TLS, query, project, branch and unauthorized runs denied; zero database/provider calls.");
