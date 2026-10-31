import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOST="ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech";
const POOLED_HOST="ep-holy-block-zauxat1w-pooler.c-2.eu-west-2.aws.neon.tech";
const ACCOUNT="707859598737";
const SECRET_NAME="hustle-payment-preview-credentials";
const KEY_NAMES=["DATABASE_URL","STAGING_AUTH_DATABASE_URL",
  "BETTER_AUTH_SECRET","HUSTLE_STAGING_TEST_EMAILS","PAYSTACK_TEST_SECRET_KEY"];

export function normalizedPreviewRuntimeUrls(raw) {
  let url;
  try { url=new URL(raw||""); } catch { throw new Error("REFUSED: private preview runtime database URL missing"); }
  const query=[...url.searchParams.keys()];
  if(url.protocol!=="postgresql:" || ![HOST,POOLED_HOST].includes(url.hostname) ||
     url.username!=="hustle_payment_preview_api" ||
     !url.password || decodeURIComponent(url.password).length<16 ||
     url.pathname!=="/hustle_payment_preview" || url.port || url.hash ||
     url.searchParams.get("sslmode")!=="require" ||
     query.some(k=>!["sslmode","channel_binding"].includes(k)) ||
     (url.searchParams.has("channel_binding") && url.searchParams.get("channel_binding")!=="require")) {
       throw new Error("REFUSED: wrong preview database/role/host or missing TLS");
  }
  // The runtime requires direct (nonpooler) host and exact query parameters.
  url.hostname=HOST;
  url.search="?sslmode=require&schema=public";
  const app=url.toString();
  url.searchParams.set("schema","payment_auth");
  return {app,auth:url.toString()};
}

export function validatePreviewEmails(raw) {
  const emails=(raw||"").split(",").map(s=>s.trim().toLowerCase()).filter(Boolean);
  if(!emails.length || emails.length>10 ||
     !emails.every(s=>/^[^\s,@]+@[^\s,@]+\.[^\s,@]+$/.test(s))) {
    throw new Error("REFUSED: provide 1-10 invited TEST-only emails in protected environment");
  }
  return emails.join(",");
}
function aws(args) {
  return execFileSync("aws",[...args,"--region","eu-west-2","--output","json"],
    {encoding:"utf8",maxBuffer:1024*1024,stdio:["ignore","pipe","pipe"]});
}
function readJson(args){return JSON.parse(aws(args));}
function requireContext(env) {
  if(env.GITHUB_REPOSITORY!=="realxpen/hustle-economy-of-you" ||
     env.GITHUB_REF!=="refs/heads/main" ||
     env.HUSTLE_NEON_PROJECT_ID!=="fragrant-field-59689896" ||
     env.HUSTLE_NEON_BRANCH_ID!=="br-curly-leaf-zat0ec8m" ||
     env.HUSTLE_PREVIEW_SECRET_APPROVAL!=="I_AUTHORIZE_TEST_ONLY_SECRET_SETUP" ||
     !["PREPARE_DATABASE_AND_AUTH","FINALIZE_TEST_ONLY"].includes(env.HUSTLE_PREVIEW_SECRET_PHASE) ||
     env.PAYSTACK_SECRET_KEY || env.DATABASE_URL || env.STAGING_AUTH_DATABASE_URL) {
       throw new Error("REFUSED: protected test-only secret setup approval/target missing");
  }
}
function requireOldSecret(meta,old) {
  assert.equal(meta.Name,SECRET_NAME);
  assert.ok(meta.ARN.startsWith("arn:aws:secretsmanager:eu-west-2:"+ACCOUNT+
    ":secret:"+SECRET_NAME+"-"),"Wrong AWS secret");
  assert.equal(meta.Tags?.find(t=>t.Key==="status")?.Value,"not-configured",
    "Refused: secret is not inactive");
  assert.deepEqual(Object.keys(old).sort(),KEY_NAMES.slice().sort(),
    "Unexpected secret JSON keys");
}

export function configureSecret(env=process.env) {
  requireContext(env);
  const phase=env.HUSTLE_PREVIEW_SECRET_PHASE;
  const {app,auth}=normalizedPreviewRuntimeUrls(env.HUSTLE_PREVIEW_NEON_API_URL);
  const account=readJson(["sts","get-caller-identity"]);
  if(account.Account!==ACCOUNT) throw new Error("REFUSED: wrong AWS account");
  const meta=readJson(["secretsmanager","describe-secret","--secret-id",SECRET_NAME]);
  const before=readJson(["secretsmanager","get-secret-value","--secret-id",meta.ARN]);
  const previous=JSON.parse(before.SecretString);
  requireOldSecret(meta,previous);
  const next={...previous};
  for(const [key,value] of [["DATABASE_URL",app],["STAGING_AUTH_DATABASE_URL",auth]]) {
    if(next[key]!=="NOT_CONFIGURED" && next[key]!==value)
      throw new Error("REFUSED: existing dedicated Neon credential mismatch; do not overwrite");
    next[key]=value;
  }
  if(next.BETTER_AUTH_SECRET==="NOT_CONFIGURED")
    next.BETTER_AUTH_SECRET=randomBytes(48).toString("base64url");
  if(next.BETTER_AUTH_SECRET.length<32)
    throw new Error("REFUSED: invalid dedicated Better Auth secret");
  if(phase==="FINALIZE_TEST_ONLY") {
    // This is a real read-only check with the restricted RUNTIME role. No
    // provider credential can be activated before migrations and role access.
    const target=new URL(app);
    const sql=`SELECT CASE WHEN
      (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='public') >= 30
      AND (SELECT count(*) FROM pg_catalog.pg_tables WHERE schemaname='payment_auth'
           AND tablename IN ('user','session','account','verification','rateLimit'))=5
      AND has_table_privilege(current_user, 'public."User"', 'SELECT')
      AND has_table_privilege(current_user, 'payment_auth."user"', 'SELECT')
      THEN 'ready' ELSE 'not-ready' END;`;
    let answer;
    try {
      answer=execFileSync("psql",["--no-psqlrc","-X","-At","-v","ON_ERROR_STOP=1",
        "-c",sql],{encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:20000,
        env:{...process.env,PGHOST:target.hostname,PGDATABASE:"hustle_payment_preview",
          PGUSER:"hustle_payment_preview_api",PGPASSWORD:decodeURIComponent(target.password),
          PGSSLMODE:"require"}}).trim();
    } catch {throw new Error("REFUSED: independent migrated Neon schema not ready");}
    if(answer!=="ready") throw new Error("REFUSED: preview app/auth tables or runtime grants not ready");
    const paystack=env.HUSTLE_PREVIEW_PAYSTACK_TEST_KEY||"";
    if(!/^sk_test_[A-Za-z0-9]{12,}$/.test(paystack))
      throw new Error("REFUSED: only valid Paystack TEST secret allowed");
    const emails=validatePreviewEmails(env.HUSTLE_PREVIEW_TEST_EMAILS);
    if(next.PAYSTACK_TEST_SECRET_KEY!=="NOT_CONFIGURED" &&
       next.PAYSTACK_TEST_SECRET_KEY!==paystack) {
      throw new Error("REFUSED: existing test provider credential mismatch");
    }
    next.PAYSTACK_TEST_SECRET_KEY=paystack;
    next.HUSTLE_STAGING_TEST_EMAILS=emails;
  } else {
    if(next.PAYSTACK_TEST_SECRET_KEY!=="NOT_CONFIGURED")
      throw new Error("REFUSED: PREPARE must never overwrite provider configuration");
  }

  // The AWS CLI receives credentials only through a private file (0600), never
  // through command arguments, logs, PRs, workflow inputs, or chat messages.
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),"hustle-preview-secret-"));
  const file=path.join(folder,"secret.json");
  try {
    fs.chmodSync(folder,0o700);
    fs.writeFileSync(file,JSON.stringify(next),{mode:0o600,flag:"wx"});
    const result=readJson(["secretsmanager","put-secret-value","--secret-id",meta.ARN,
      "--secret-string","file://"+file]);
    if(!result.VersionId) throw new Error("Missing AWS Secrets Manager version");
  } finally {
    fs.rmSync(folder,{recursive:true,force:true});
  }
  if(phase==="FINALIZE_TEST_ONLY") {
    // Only after the independent PG17 schema check in the manual workflow.
    aws(["secretsmanager","tag-resource","--secret-id",meta.ARN,
      "--tags","Key=status,Value=configured-test-only"]);
  }
  console.log("PASS: scoped AWS payment-preview secret updated; "+
    (phase==="FINALIZE_TEST_ONLY"
      ?"test-only configuration ready, no deployment"
      :"database and Better Auth set; Paystack key still disabled"));
}
if(process.argv[1] && path.resolve(process.argv[1])===path.resolve(new URL(import.meta.url).pathname)) {
  try {configureSecret();}catch(e){console.error(e.message);process.exitCode=1;}
}
