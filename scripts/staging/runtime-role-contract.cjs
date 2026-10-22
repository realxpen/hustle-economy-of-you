"use strict";
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const { provisionRuntime } = require("./activate-and-build.cjs");
const url = new URL(process.env.DATABASE_URL || "");
assert.equal(url.hostname, "127.0.0.1");
const db = new PrismaClient();
const password = "a".repeat(64);
async function asRole(role, schema, task) {
  const target = new URL(url); target.username = role; target.password = password;
  target.searchParams.set("schema", schema);
  const client = new PrismaClient({ datasources: { db: { url: target.toString() } } });
  try { await task(client); } finally { await client.$disconnect(); }
}
(async () => {
  await provisionRuntime(db, password, password);
  await asRole("hustle_api", "public", async client => {
    assert.equal((await client.$queryRawUnsafe('SELECT count(*)::int AS n FROM public."User"'))[0].n, 0);
    for (const sql of ['SELECT * FROM hustle_auth."user"', 'SELECT * FROM neon_auth."user"', 'CREATE TABLE public.forbidden_table(id int)']) {
      await assert.rejects(() => client.$queryRawUnsafe(sql));
    }
    const roles = await client.$queryRawUnsafe("SELECT rolsuper,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user");
    assert.deepEqual(roles[0], { rolsuper: false, rolcreaterole: false, rolbypassrls: false });
  });
  await asRole("hustle_auth_runtime", "hustle_auth", async client => {
    assert.equal((await client.$queryRawUnsafe('SELECT count(*)::int AS n FROM hustle_auth."user"'))[0].n, 0);
    await client.$executeRawUnsafe('INSERT INTO hustle_auth.verification (id,identifier,value,"expiresAt","updatedAt") VALUES (\'fixture\',\'fixture\',\'fixture\',now(),now())');
    await client.$executeRawUnsafe("DELETE FROM hustle_auth.verification WHERE id='fixture'");
    for (const sql of ['SELECT * FROM public."User"', 'SELECT * FROM neon_auth."user"', 'SELECT * FROM hustle_auth._prisma_migrations']) {
      await assert.rejects(() => client.$queryRawUnsafe(sql));
    }
  });
  console.log("PASS: actual restricted runtime logins, auth CRUD and cross-schema/DDL denials.");
})().catch(error => { console.error("RUNTIME_ROLE_CONTRACT_FAILED", error.code, error.meta?.code, error.meta?.message); process.exitCode = 1; }).finally(() => db.$disconnect());
