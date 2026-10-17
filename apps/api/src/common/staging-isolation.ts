// Fail-closed boundary for the *separate* Vercel staging API project.
// No external operations; never log connection strings, keys, or user data.
type StagingEnvironment = Record<string, string | undefined>;
const KNOWN_NONSTAGING_REFS = new Set([
  "pfgarmyygybmhiiuopym", // active Hustle, not a staging project
  "rtcjismwbrvulccryyau", // unrelated active project
  "vkedlbnvehgfenmwgqrw"  // unrelated project (may be paused)
]);
function fail(): never {
  throw new Error("STAGING_ISOLATION_FAILED: separate Supabase Auth and database are required");
}
export function assertStagingApiIsolation(env: StagingEnvironment) {
  if (env.HUSTLE_DEPLOY_ENV !== "staging") return;
  const ref = env.HUSTLE_STAGING_SUPABASE_REF?.trim();
  if (!ref || !/^[a-z]{20}$/.test(ref) || KNOWN_NONSTAGING_REFS.has(ref)) fail();
  if (!env.DATABASE_URL || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) fail();
  try {
    const auth = new URL(env.SUPABASE_URL);
    if (auth.protocol !== "https:" || auth.hostname !== ref + ".supabase.co"
      || auth.pathname !== "/" || auth.username || auth.password || auth.port
      || auth.search || auth.hash) fail();
    const db = new URL(env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(db.protocol) || !db.password) fail();
    const direct = db.hostname === "db." + ref + ".supabase.co";
    const pooler = db.hostname.endsWith(".pooler.supabase.com")
      && decodeURIComponent(db.username) === "postgres." + ref;
    if (!direct && !pooler) fail();
    if (env.SUPABASE_PUBLISHABLE_KEY.startsWith("sb_secret_")) fail();
  } catch { fail(); }
}
export function stagingMutationBlocked(env: StagingEnvironment, method: string, rawPath: string) {
  if (env.HUSTLE_DEPLOY_ENV !== "staging" || ["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return false;
  const path = rawPath.split("?")[0].replace(/^\/api\/v1\//, "/").toLowerCase();
  return /^\/(payments|wallet|financial|financial-operations|moniflow|sandbox|webhooks)(\/|$)/.test(path)
    || /^\/cart\/checkout(\/|$)/.test(path)
    || /^\/orders(\/|$)/.test(path)
    || /^\/bookings(\/|$)/.test(path); // Preview never initiates booking writes.
}
