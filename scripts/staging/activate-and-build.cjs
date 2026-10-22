"use strict";
// One-time activation for the separately approved, empty staging database only.
// This is a Vercel project override, never the production API build command.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "../..");
const { PrismaClient } = require(path.join(root, "node_modules/@prisma/client"));
const host = "ep-square-sea-zax0gyud.c-2.eu-west-2.aws.neon.tech";
function target(value, role, schema) {
  const url = new URL(value || "");
  if (url.protocol !== "postgresql:" || url.hostname !== host || url.pathname !== "/hustle_staging" ||
      url.port || url.hash || url.username !== role || url.searchParams.get("schema") !== schema ||
      url.searchParams.get("sslmode") !== "require" || !url.password) throw Error("STAGING_TARGET_REJECTED");
  return url;
}
function command(binary, args, env = process.env) {
  const result = spawnSync(binary, args, { cwd: root, env, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.status !== 0) throw Error("STAGING_BUILD_OR_MIGRATION_FAILED");
}
async function activate() {
  if (process.env.VERCEL_PROJECT_ID !== "prj_1zba0YSCmWxYxkKQApt8JGAgVTHW" ||
      process.env.HUSTLE_RUNTIME_SCOPE !== "isolated-staging") throw Error("STAGING_PROJECT_REJECTED");
  const owner = target(process.env.HUSTLE_STAGING_MIGRATION_URL, "hustle_staging_bootstrap_20261022", "public");
  const api = target(process.env.DATABASE_URL, "hustle_api", "public");
  const auth = target(process.env.STAGING_AUTH_DATABASE_URL, "hustle_auth_runtime", "hustle_auth");
  for (const url of [api, auth]) if (!/^[a-f0-9]{64}$/.test(url.password)) throw Error("STAGING_PASSWORD_FORMAT_REJECTED");
  // Projection remains in scratch; the original production migrations are untouched.
  command(process.execPath, ["scripts/staging/neon-prisma-projection.cjs", "/tmp/hustle-neon-application-projection"],
    { ...process.env, NODE_ENV: "test" });
  const prisma = path.join(root, "node_modules/prisma/build/index.js");
  command(process.execPath, [prisma, "migrate", "deploy", "--schema=/tmp/hustle-neon-application-projection/schema.prisma"],
    { ...process.env, DATABASE_URL: owner.toString() });
  const authOwner = new URL(owner); authOwner.searchParams.set("schema", "hustle_auth");
  command(process.execPath, [prisma, "migrate", "deploy", "--schema=apps/api/staging-auth/prisma/schema.prisma"],
    { ...process.env, STAGING_AUTH_DATABASE_URL: authOwner.toString() });
  const db = new PrismaClient({ datasources: { db: { url: owner.toString() } } });
  try { await provisionRuntime(db, api.password, auth.password); }
  finally { await db.$disconnect(); }
  console.log("PASS: isolated staging Prisma histories deployed; separate restricted API/Auth logins provisioned.");
}
async function provisionRuntime(db, apiPassword, authPassword) {
  if (![apiPassword, authPassword].every(value => /^[a-f0-9]{64}$/.test(value))) throw Error("STAGING_PASSWORD_FORMAT_REJECTED");
    await db.$transaction(async tx => {
      const rows = await tx.$queryRawUnsafe('SELECT count(*)::int AS n FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
      if (rows[0].n !== 41) throw Error("STAGING_MIGRATION_COUNT_REJECTED");
      const existing = await tx.$queryRawUnsafe("SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname IN ('hustle_api','hustle_auth_runtime')");
      if (existing.some(role => role.rolsuper || role.rolbypassrls)) throw Error("STAGING_RUNTIME_ROLE_UNSAFE");
      // Passwords are generated hexadecimal, validated above; never printed.
      await tx.$executeRawUnsafe(`ALTER ROLE hustle_api LOGIN NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${apiPassword}'`);
      const roles = await tx.$queryRawUnsafe("SELECT 1 FROM pg_roles WHERE rolname='hustle_auth_runtime'");
      if (!roles.length) await tx.$executeRawUnsafe("CREATE ROLE hustle_auth_runtime NOLOGIN");
      await tx.$executeRawUnsafe(`ALTER ROLE hustle_auth_runtime LOGIN NOCREATEDB NOCREATEROLE NOINHERIT PASSWORD '${authPassword}'`);
      await tx.$executeRawUnsafe("GRANT USAGE ON SCHEMA hustle_auth TO hustle_auth_runtime");
      await tx.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hustle_auth."user", hustle_auth.session, hustle_auth.account, hustle_auth.verification, hustle_auth."rateLimit" TO hustle_auth_runtime');
    });
}
module.exports = { provisionRuntime, target };
if (require.main === module) (async () => {
  if (process.env.HUSTLE_STAGING_MIGRATION_URL) await activate();
  command("npm", ["run", "build", "--workspace=@hustle/api"]);
  console.log("PASS: API build completed.");
})().catch(() => { console.error("ISOLATED_STAGING_BUILD_FAILED: private database diagnostics suppressed."); process.exitCode = 1; });
