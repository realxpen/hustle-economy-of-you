#!/usr/bin/env node
"use strict";
/**
 * Construct an independently reviewed, staging-ONLY projection of the actual
 * historical Prisma migration SQL. It is NEVER written back to apps/api/prisma.
 * No credentials, DB connections, schemas or production migrations are changed.
 *
 * The projected migrations must only run in a disposable CI database until an
 * additional owner-approved hosted Neon migration gate is implemented.
 */
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const root=path.resolve(__dirname,"../..");
const input=path.join(root,"apps/api/prisma");
const dirs=fs.readdirSync(path.join(input,"migrations"),{withFileTypes:true})
  .filter(x=>x.isDirectory()).map(x=>x.name).sort();
const STORE_ONLY=new Set([
  "20260908113729_phase3_hustler_proof_storage",
  "20260910113645_phase10_messaging_attachments"
]);
const STORAGE_SUFFIX={
  "20260917123000_phase16b_story_experience":"INSERT INTO storage.buckets",
  "20261007110000_phase18a_agent_capability_foundation":"insert into storage.buckets"
};
const DUPLICATE_STORY="20260917130500_phase16b_story_rls_hardening";
const API_ROLE="20260906023000_api_database_role";
const DENIED_ROLES=new Set([
  "20260917124500_phase16b_story_rls_hardening",
  "20260917143000_phase17a_live_commerce_foundation",
  "20260918110000_phase17b_native_live_media",
  "20261007114500_phase18b_agent_relationship_permissions",
  "20261007133000_phase18c_agent_assisted_onboarding",
  "20261008011000_phase19c_marketplace_casework",
  "20261008085000_phase19d_marketplace_content_enforcement",
  "20261008114000_phase19e_enforcement_appeals",
  "20261009130000_phase20a_notification_inbox",
  "20261015132000_flowtime_revision_access",
  "20261016120000_marketplace_casework_api_access"
]);

function noSqlComments(sql) {
  return sql.split("\n").filter(line=>!line.trim().startsWith("--")).join("\n");
}
function projectSql(name,sql) {
  if(STORE_ONLY.has(name)){
    assert.match(sql,/\bstorage\.buckets\b/i,name+" no longer storage-only");
    assert.doesNotMatch(sql,/\bCREATE\s+TABLE\b/i,name+" unexpectedly defines a table");
    // Messaging helper is solely used by removed Supabase Storage policies.
    if(name.includes("messaging"))assert.match(sql,/hustle_is_conversation_participant/);
    return "-- Intentionally omitted Supabase Storage-only migration in isolated Neon staging.\n";
  }
  if(Object.hasOwn(STORAGE_SUFFIX,name)) {
    const marker=STORAGE_SUFFIX[name];
    assert.equal(sql.split(marker).length,2,"Storage section must be one terminal suffix: "+name);
    const [app,storage]=sql.split(marker);
    assert.match(storage,/\bstorage\.objects\b|\bstorage\.buckets\b/i);
    assert.doesNotMatch(storage,/\bCREATE\s+TABLE\b|\bALTER\s+TABLE\b/i,
      "Application DDL may not be excluded: "+name);
    assert.match(app,/CREATE TABLE|ALTER TABLE/i,
      "Preserve real Story/Agent tables: "+name);
    sql=app+"\n-- Neon staging: excluded only provider-specific Storage bucket/policies.\n";
  }
  if(name===DUPLICATE_STORY){
    assert.match(sql,/CREATE POLICY hustle_api_story_all/i);
    assert.match(sql,/CREATE POLICY hustle_api_story_view_all/i);
    // Previous 20260917124500 migration already establishes these policies.
    // The old PG16/17 CI resolves this redundant migration as applied.
    return "-- Original Story policy duplicate intentionally represented as no-op on Neon.\n"+
      "-- Earlier 20260917124500 migration already creates all four RLS policies.\n";
  }
  if(name===API_ROLE) {
    assert.equal(sql.split("CREATE ROLE hustle_api LOGIN;").length,2,
      "Refuse changed role bootstrap assumptions");
    sql=sql.replace("CREATE ROLE hustle_api LOGIN;","CREATE ROLE hustle_api NOLOGIN;");
  }
  const roleRefs=sql.match(/\b(?:anon|authenticated)\b/g) || [];
  if(roleRefs.length) {
    assert.ok(DENIED_ROLES.has(name),"Unexpected Supabase role in migration: "+name);
    const before=sql;
    sql=sql.replace(/\bFROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\s*,\s*hustle_api\b/gi,
      "FROM PUBLIC, hustle_api");
    sql=sql.replace(/\bFROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated\b/gi,"FROM PUBLIC");
    sql=sql.replace(/\bFROM\s+anon\s*,\s*authenticated\b/gi,"FROM PUBLIC");
    assert.notEqual(sql,before,"Supabase-specific role rewrite did not occur: "+name);
  }
  const active=noSqlComments(sql);
  assert.doesNotMatch(active,/\b(?:storage\.|auth\.uid\s*\(|\banon\b|\bauthenticated\b)/i,
    "Projected migration still depends on Supabase objects: "+name);
  if(sql!==noSqlComments(sql)){
    // Comments are preserved and may mention Supabase; only runnable SQL matters.
  }
  return sql;
}

function run(dest) {
  if(process.env.NODE_ENV!=="test" || !dest)throw Error("Projection generation is only enabled in test mode");
  const abs=path.resolve(dest);
  if(abs.startsWith(path.join(root,"apps")) || abs.startsWith(path.join(root,"infra")) ||
     abs===input || abs==="/" || abs===root)throw Error("Refusing to overwrite application or source directory");
  assert.equal(dirs.length,41,"Historical migration list changed: review projection");
  const changed=[];
  fs.mkdirSync(path.join(abs,"migrations"),{recursive:true});
  fs.copyFileSync(path.join(input,"schema.prisma"),path.join(abs,"schema.prisma"));
  for(const name of dirs) {
    const src=fs.readFileSync(path.join(input,"migrations",name,"migration.sql"),"utf8");
    const projection=projectSql(name,src);
    const outdir=path.join(abs,"migrations",name);
    fs.mkdirSync(outdir,{recursive:true});
    fs.writeFileSync(path.join(outdir,"migration.sql"),projection);
    if(projection!==src)changed.push(name);
  }
  fs.writeFileSync(path.join(abs,"migrations","migration_lock.toml"),
    '# Provider is fixed; these projected files are staging-only.\nprovider = "postgresql"\n');
  const expected=new Set([...STORE_ONLY,...Object.keys(STORAGE_SUFFIX),
    DUPLICATE_STORY,API_ROLE,...DENIED_ROLES]);
  assert.deepEqual(new Set(changed),expected,"Migration transformation manifest drift");
  const audit={total:dirs.length,changed:changed.length,
    unchanged:dirs.length-changed.length,excludedStorageOnly:STORE_ONLY.size,
    splitApplicationAndStorage:Object.keys(STORAGE_SUFFIX).length,
    skippedDuplicateStory:1,retainedManagedAuth:true,
    createdApplicationRoleLogin:false,requiresHostedApproval:true};
  fs.writeFileSync(path.join(abs,"projection-audit.json"),JSON.stringify(audit,null,2)+"\n");
  console.log("PASS: projected "+dirs.length+" actual Prisma migrations with "+
    changed.length+" explicit provider-specific changes. Original migrations untouched.");
  console.log("BOUNDARY: no host credentials, schema writes, Neon Auth mutation or deployment.");
}
if(require.main===module) {
  try{run(process.argv[2]);}
  catch(err){console.error("PROJECTION REFUSED:",err.message);process.exitCode=1;}
}
module.exports={projectSql,run,STORE_ONLY,STORAGE_SUFFIX,DENIED_ROLES};
