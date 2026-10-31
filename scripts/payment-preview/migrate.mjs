// UX046 — operator-controlled one-time SQL migration for a NEW, empty Neon
// payment-preview project. Never imports production data or copies any keys.
// Runs only in a manually approved GitHub environment with a privately supplied
// owner connection URL. No network or DB activity occurs on import.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const project = "fragrant-field-59689896";
export const branch = "br-curly-leaf-zat0ec8m";
export const host = "ep-holy-block-zauxat1w.c-2.eu-west-2.aws.neon.tech";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dbname = "hustle_payment_preview";
const owner = "hustle_payment_preview_owner";
const apiRole = "hustle_payment_preview_api";

export function validateMigrationTarget(raw) {
  let url;
  try { url = new URL(raw || ""); } catch { throw new Error("REFUSED: missing protected test-only Neon owner URL"); }
  const keys = [...url.searchParams.keys()];
  if (url.protocol !== "postgresql:" || url.hostname !== host ||
      url.pathname !== "/" + dbname || url.username !== owner ||
      !url.password || url.password.length < 16 ||
      url.port || url.hash || url.searchParams.get("sslmode") !== "require" ||
      url.searchParams.get("schema") !== "public" ||
      keys.some(k => !["schema","sslmode"].includes(k))) {
    throw new Error("REFUSED: migration authority must be the exact dedicated unpooled Neon project owner and TLS database");
  }
  return url;
}

function exec(command, args, env) {
  const r = spawnSync(command,args,{cwd:root,env,stdio:"inherit",timeout:12*60*1000});
  if (r.error || r.status !== 0) throw new Error(command+" migration stage failed; no other environment affected");
}
function pgEnv(url) {
  return {...process.env,PGHOST:url.hostname,PGUSER:url.username,
    PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:dbname,
    PGSSLMODE:"require",PGCONNECT_TIMEOUT:"15"};
}
function psql(env, file) {
  exec("psql",["--no-psqlrc","-X","-v","ON_ERROR_STOP=1","-f",file],env);
}
function prisma(env, schemaPath, action, applied) {
  exec("npx",["prisma","migrate",action,
    ...(applied?["--applied",applied]:[]),
    "--schema="+schemaPath],env);
}

export function migrate(env = process.env) {
  if (env.HUSTLE_PREVIEW_SCHEMA_APPROVAL !== "I_AUTHORIZE_ISOLATED_TEST_SCHEMA_ONLY" ||
      env.GITHUB_REPOSITORY !== "realxpen/hustle-economy-of-you" ||
      env.GITHUB_REF !== "refs/heads/main" ||
      env.HUSTLE_NEON_PROJECT_ID !== project ||
      env.HUSTLE_NEON_BRANCH_ID !== branch ||
      env.NODE_ENV === "production" ||
      env.DATABASE_URL || env.STAGING_AUTH_DATABASE_URL || env.PAYSTACK_SECRET_KEY ||
      env.PAYSTACK_TEST_SECRET_KEY) {
    throw new Error("REFUSED: manual main-only isolated Neon migration authorization missing or foreign environment detected");
  }
  const target = validateMigrationTarget(env.HUSTLE_PREVIEW_MIGRATION_URL);
  const pg = pgEnv(target);
  console.log("UX046: initializing dedicated empty payment-preview schemas (no customer or real payment data)");
  // Preflight must pass BEFORE CREATE ROLE/schema work. It also detects any
  // partial prior migration — reruns are intentionally rejected for review.
  psql(pg,"scripts/payment-preview/preflight.sql");
  psql(pg,"scripts/payment-preview/neon-compat.sql");
  const base=target.toString();
  const appEnv={...env,DATABASE_URL:base,STAGING_AUTH_DATABASE_URL:undefined};
  // This historical Story migration creates the same four policies as its
  // preceding migration without IF NOT EXISTS. Only the duplicate is marked
  // already represented; all other genuine migrations still run normally.
  prisma(appEnv,"apps/api/prisma/schema.prisma","resolve",
    "20260917130500_phase16b_story_rls_hardening");
  prisma(appEnv,"apps/api/prisma/schema.prisma","deploy");
  // Better Auth tables belong to the independent payment_auth schema.
  const auth= new URL(base);auth.searchParams.set("schema","payment_auth");
  prisma({...env,STAGING_AUTH_DATABASE_URL:auth.toString(),DATABASE_URL:undefined},
    "apps/api/staging-auth/prisma/schema.prisma","deploy");
  psql(pg,"scripts/payment-preview/grants-and-check.sql");
  console.log("PASS: independent payment-preview app/auth schemas migrated; no public API or Paystack enabled.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { migrate(); } catch(e){console.error(e.message);process.exitCode=1;}
}
