#!/usr/bin/env node
// Main-only protected workflow; only the named disposable Neon child is accepted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const HOST = 'ep-holy-waterfall-zav0drxb.c-2.eu-west-2.aws.neon.tech';
const BRANCH = 'br-mute-rain-zamdwv8j';

function validateTarget(env) {
  if (env.HUSTLE_REHEARSAL_BRANCH !== BRANCH) throw Error('Wrong rehearsal branch');
  const u = new URL(env.HUSTLE_NEON_REHEARSAL_DATABASE_URL || '');
  if (u.protocol !== 'postgresql:' || u.hostname !== HOST || u.port || u.hash ||
      u.pathname !== '/hustle_staging' || u.username !== 'hustle_staging_owner' || !u.password ||
      u.searchParams.get('sslmode') !== 'require') throw Error('Wrong rehearsal database');
  const allowed = new Set(['sslmode', 'channel_binding', 'schema']);
  for (const key of u.searchParams.keys()) {
    if (!allowed.has(key) || u.searchParams.getAll(key).length !== 1) throw Error('Unexpected database option');
  }
  if (u.searchParams.has('schema') && u.searchParams.get('schema') !== 'public') throw Error('Wrong source schema');
  for (const key of ['DATABASE_URL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','PAYSTACK_SECRET_KEY','MONNIFY_API_KEY','VERCEL_TOKEN','EXPO_TOKEN']) {
    if (env[key]) throw Error('Foreign runtime credentials refused');
  }
  return u;
}

function offline() {
  const env = { HUSTLE_REHEARSAL_BRANCH: BRANCH,
    HUSTLE_NEON_REHEARSAL_DATABASE_URL: `postgresql://hustle_staging_owner:fixture@${HOST}/hustle_staging?sslmode=require` };
  assert.equal(validateTarget(env).hostname, HOST);
  for (const url of [env.HUSTLE_NEON_REHEARSAL_DATABASE_URL.replace(HOST, 'ep-square-sea-zax0gyud.c-2.eu-west-2.aws.neon.tech'),
    env.HUSTLE_NEON_REHEARSAL_DATABASE_URL.replace(HOST, HOST.replace('.', '-pooler.')),
    env.HUSTLE_NEON_REHEARSAL_DATABASE_URL.replace('hustle_staging?', 'other?'),
    env.HUSTLE_NEON_REHEARSAL_DATABASE_URL.replace('sslmode=require','sslmode=disable'),
    env.HUSTLE_NEON_REHEARSAL_DATABASE_URL+'&schema=neon_auth',
    env.HUSTLE_NEON_REHEARSAL_DATABASE_URL+'&sslmode=disable']) {
    assert.throws(() => validateTarget({ ...env, HUSTLE_NEON_REHEARSAL_DATABASE_URL: url }));
  }
  assert.throws(() => validateTarget({ ...env, HUSTLE_REHEARSAL_BRANCH: 'br-dawn-hat-zag7c5ae' }));
  assert.throws(() => validateTarget({ ...env, SUPABASE_SERVICE_ROLE_KEY: 'fixture' }));
  console.log('PASS: exact disposable-child, direct TLS URL and no foreign-credential guards');
}

async function run() {
  const url = validateTarget(process.env);
  const appUrl = new URL(url); appUrl.searchParams.set('schema', 'public');
  const authUrl = new URL(url); authUrl.searchParams.set('schema', 'hustle_auth');
  const { PrismaClient } = require('../../apps/api/node_modules/@hustle/staging-auth-client');
  const db = new PrismaClient({ datasources: { db: { url: authUrl.toString() } } });
  let appDb, authUserId;
  const report = { branch: BRANCH, project: 'summer-sound-54525078', commit: process.env.GITHUB_SHA,
    status: 'INCOMPLETE', productionAccessed: false, hostedApiDeployed: false };
  const query = sql => db.$queryRawUnsafe(sql);
  const fingerprint = async () => (await query("SELECT md5(string_agg(c.oid::text||c.relname||c.relowner::text||coalesce(c.relacl::text,''),',' ORDER BY c.relname)) AS hash FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='neon_auth' AND c.relkind='r'"))[0].hash;
  function command(args, extra = {}) {
    // Child stdout/stderr can include secrets. Capture privately and report only a fixed stage code.
    const r = spawnSync(process.execPath, args, { env: { ...process.env, ...extra }, encoding: 'utf8', timeout: 180_000 });
    if (r.status !== 0) throw Error('Private child process failed');
  }
  try {
    const initial = await query("SELECT current_database() AS db, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS app, (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='hustle_auth') AS auth");
    assert.equal(initial[0].db, 'hustle_staging'); assert.equal(initial[0].app, 0); assert.equal(initial[0].auth, 0);
    const before = await fingerprint();
    command(['scripts/staging/neon-prisma-projection.cjs','/tmp/hustle-neon-application-projection'], { NODE_ENV: 'test' });
    const prisma = 'node_modules/prisma/build/index.js';
    command([prisma,'migrate','deploy','--schema=/tmp/hustle-neon-application-projection/schema.prisma'], { DATABASE_URL: appUrl.toString() });
    command([prisma,'migrate','deploy','--schema=apps/api/staging-auth/prisma/schema.prisma'], { STAGING_AUTH_DATABASE_URL: authUrl.toString() });
    const counts = await query("SELECT (SELECT count(*)::int FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS app, (SELECT count(*)::int FROM hustle_auth._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS auth");
    assert.deepEqual(counts[0], { app: 41, auth: 1 });
    // Second deploy must succeed with both histories intact.
    command([prisma,'migrate','deploy','--schema=/tmp/hustle-neon-application-projection/schema.prisma'], { DATABASE_URL: appUrl.toString() });
    command([prisma,'migrate','deploy','--schema=apps/api/staging-auth/prisma/schema.prisma'], { STAGING_AUTH_DATABASE_URL: authUrl.toString() });
    assert.equal(await fingerprint(), before);
    const roles = (await query("SELECT rolcanlogin,rolsuper,rolbypassrls,has_schema_privilege('hustle_api','hustle_auth','USAGE') AS private_auth,has_schema_privilege('hustle_api','neon_auth','USAGE') AS managed_auth FROM pg_roles WHERE rolname='hustle_api'"))[0];
    assert.deepEqual(roles, { rolcanlogin: false, rolsuper: false, rolbypassrls: false, private_auth: false, managed_auth: false });
    const { createExpoStagingAuth, ExpoStagingAuthService } = require('../../apps/api/dist/auth/expo-staging-auth.service');
    const { PrismaService } = require('../../apps/api/dist/database/prisma.service');
    const { AuthService } = require('../../apps/api/dist/auth/auth.service');
    process.env.DATABASE_URL = appUrl.toString();
    appDb = new PrismaService();
    const auth = createExpoStagingAuth(db, { baseURL: 'http://localhost:43182/api/auth', secret: crypto.randomBytes(48).toString('base64url'), allowedEmails: ['neon-rehearsal@example.invalid'] });
    const password = crypto.randomBytes(24).toString('base64url');
    const signed = await auth.api.signUpEmail({ body: { email: 'neon-rehearsal@example.invalid', password, name: 'Disposable rehearsal' } });
    authUserId = signed.user.id;
    const port = new ExpoStagingAuthService(() => auth);
    const identity = await port.verifyAccessToken(signed.token);
    const accounts = new AuthService(appDb);
    const first = await accounts.sync(identity);
    const second = await accounts.sync(identity);
    assert.equal(first.id, second.id);
    const capabilities = await appDb.userCapability.findMany({ where: { userId: first.id } });
    assert.equal(capabilities.length, 1); assert.equal(capabilities[0].capability, 'CLIENT'); assert.equal(capabilities[0].status, 'ACTIVE');
    await auth.api.signOut({ headers: new Headers({ authorization: `Bearer ${signed.token}` }) });
    await assert.rejects(() => port.verifyAccessToken(signed.token));
    for (const table of ['Booking','PaymentAttempt','EscrowRecord']) assert.equal((await query(`SELECT count(*)::int AS n FROM public."${table}"`))[0].n, 0);
    Object.assign(report, { status: 'PASS', applicationMigrations: 41, authMigrations: 1, secondDeployPassed: true,
      managedAuthCatalogPreserved: true, apiRoleRestricted: true, generatedPasswordSignUpAndRevocationPassed: true,
      actualAccountSyncClientOnlyPassed: true, publicApiAndNativeDeviceUntested: true });
  } finally {
    if (authUserId) {
      await appDb?.user.deleteMany({ where: { authSubject: authUserId } });
      await db.user.deleteMany({ where: { id: authUserId } });
    }
    await appDb?.$disconnect(); await db.$disconnect();
    fs.mkdirSync('/tmp/hustle-neon-private-report', { recursive: true });
    fs.writeFileSync('/tmp/hustle-neon-private-report/report.json', JSON.stringify(report, null, 2)+'\n', { mode: 0o600 });
  }
  console.log('PASS: actual disposable Neon Prisma deploy, repeat deploy, role boundary and generated account sync');
}

if (require.main === module) {
  if (process.argv[2] === '--offline') offline();
  else run().catch(() => { console.error('PRIVATE_NEON_REHEARSAL_FAILED: raw private diagnostics suppressed'); process.exitCode = 1; });
}
module.exports = { validateTarget };
