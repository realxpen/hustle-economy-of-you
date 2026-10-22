#!/usr/bin/env node
"use strict";
/**
 * Staging only: inspect the actual PG17-tested Prisma projection and build a
 * reviewed, fail-closed migration manifest for the disposable REAL Neon child
 * branch. DOES NOT connect to Neon, issue SQL, or authorize hosting writes.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");

const PARENT="br-dawn-hat-zag7c5ae";
const CHILD="br-dark-sunset-zay33p1s";
const PROJECT="summer-sound-54525078";
const DB="hustle_staging";
const PROJECTION="/tmp/hustle-neon-application-projection";
const ROOT=path.resolve(__dirname,"../..");
const ORIGINAL=path.join(ROOT,"apps/api/prisma/migrations");

if(require.main === module){
  try{
    assert.equal(process.env.NODE_ENV,"test","Only disposable CI runs may build this approval manifest");
    assert.notEqual(CHILD,PARENT,"Child must never equal permanent staging parent");
    assert.ok(CHILD.startsWith("br-")&&PARENT.startsWith("br-"));
    assert.ok(PROJECT.startsWith("summer-sound-"));
    for(const name of ["DATABASE_URL","SUPABASE_SERVICE_ROLE_KEY","VERCEL_TOKEN","EXPO_TOKEN",
      "NEON_AUTH_BASE_URL","NEON_AUTH_JWKS_URL","HUSTLE_STAGING_PROJECT_ID"]){
      assert.ok(!process.env[name],"Forbidden external database/provider credentials in safety audit: "+name);
    }
    const audit=JSON.parse(fs.readFileSync(path.join(PROJECTION,"projection-audit.json"),"utf8"));
    assert.equal(audit.total,41);
    assert.equal(audit.changed,17);
    assert.equal(audit.retainedManagedAuth,true);
    assert.equal(audit.createdApplicationRoleLogin,false);
    assert.equal(audit.requiresHostedApproval,true);
    const directories=fs.readdirSync(ORIGINAL,{withFileTypes:true})
      .filter(x=>x.isDirectory()).map(x=>x.name).sort();
    assert.equal(directories.length,41);
    const manifest=[];
    let modifiedCount=0, skippedCount=0, policyDrops=0;
    for(const name of directories){
      const canonical=fs.readFileSync(path.join(ORIGINAL,name,"migration.sql"),"utf8");
      const staged=fs.readFileSync(path.join(PROJECTION,"migrations",name,"migration.sql"),"utf8");
      const active=staged.split("\n").filter(l=>!l.trim().startsWith("--")).join("\n");
      if(staged!==canonical)modifiedCount++;
      if(!active.trim())skippedCount++;
      assert.doesNotMatch(active,/\bneon_auth\b/i,
        name+" MUST NOT modify managed Neon Auth objects");
      assert.doesNotMatch(active,/\b(?:storage\.|auth\.uid\s*\(|\banon\b|\bauthenticated\b)/i,
        name+" MAY NOT install Supabase-specific SQL");
      assert.doesNotMatch(active,/\b(?:DROP|TRUNCATE)\s+(?:DATABASE|SCHEMA|TABLE|ROLE|OWNED)\b/i,
        name+" contains disallowed destructive database statements");
      assert.doesNotMatch(active,/\b(?:DELETE\s+FROM|UPDATE)\s+neon_auth\b/i,
        name+" contains user/session data modifications");
      assert.doesNotMatch(active,/\bCREATE\s+ROLE\s+\w+\s+LOGIN\b/i,
        name+" introduces a database login");
      assert.doesNotMatch(active,/\bCREATE\s+SCHEMA\s+(?:storage|auth)\b/i,
        name+" creates fake provider schema");
      assert.doesNotMatch(active,/\b(?:GRANT|REVOKE)\b[^;]*\bON\s+(?:SCHEMA|TABLE)\s+neon_auth\b/i,
        name+" mutates managed Auth grants");
      const drops=active.match(/\bDROP\s+POLICY\b/gi)||[];
      policyDrops+=drops.length;
      for(const m of active.matchAll(/\bDROP\s+POLICY\b([^;]*);/gi)){
        assert.match(m[1],/^\s+IF EXISTS\b/i,
          name+" removes a policy without IF EXISTS safeguard");
      }
      manifest.push({
        migration:name,
        sha256:crypto.createHash("sha256").update(staged).digest("hex"),
        status:active.trim()?"projected-statement":"deliberate-noop",
        adjusted:staged!==canonical,
        source_sha256:crypto.createHash("sha256").update(canonical).digest("hex"),
        managed_neon_auth_access:false
      });
    }
    assert.equal(modifiedCount,17);
    assert.ok(skippedCount>=3,"Expected excluded Storage and redundant Story operations");
    assert.ok(policyDrops>=1,"Expected reviewed idempotent app-only policy cleanup");
    const roleSql=fs.readFileSync(path.join(PROJECTION,
      "migrations/20260906023000_api_database_role/migration.sql"),"utf8");
    assert.match(roleSql,/\bCREATE\s+ROLE\s+hustle_api\s+NOLOGIN\s*;/i);
    const info={
      target:{project_id:PROJECT,database:DB,parent_branch_id:PARENT,
        disposable_child_branch_id:CHILD},
      intent:"OWNER-REVIEW-REQUIRED / NEVER AUTO-APPLY",
      deployment_authorized:false,
      live_database_writes:0,
      total_migrations:manifest.length,
      adjusted_migrations:modifiedCount,
      deliberate_noops:skippedCount,
      staged_policy_drops:policyDrops,
      avoids_real_neon_auth:true,
      prohibited_actions:["auto-merge","apply to parent staging","apply to production",
        "commit credentials","complete prepared migration without owner decision"],
      migration_hashes:manifest
    };
    const out="/tmp/hustle-neon-child-branch-approval.json";
    fs.writeFileSync(out,JSON.stringify(info,null,2)+"\n",{mode:0o600});
    assert.equal(info.deployment_authorized,false);
    console.log("PASS: audited "+manifest.length+" PG17-proven migrations; "+modifiedCount+
      " guarded adjustments, "+skippedCount+" deliberate no-ops, "+
      policyDrops+" IF EXISTS app-only policy drops.");
    console.log("PASS: projected SQL avoids managed Neon Auth and Supabase legacy objects");
    console.log("PASS: separately verified child "+CHILD+" is the ONLY proposed host target");
    console.log("BOUNDARY: generated MANIFEST ONLY; no Neon SQL, connection string or hosted DB write.");
  }catch(error){
    console.error("REFUSED child-branch projection: "+error.message);
    process.exitCode=1;
  }
}
