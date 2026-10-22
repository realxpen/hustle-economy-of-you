/**
 * Guard for the planned isolated Free Neon staging deployment.
 *
 * This is NOT connected to the production NestJS bootstrap yet: the future
 * staging bootstrap must call this before any PostgreSQL or auth connection.
 * Never put the DATABASE_URL in logs or thrown errors.
 */
export const STAGING_IDENTITY = Object.freeze({
  projectId: "summer-sound-54525078",
  branchId: "br-dawn-hat-zag7c5ae",
  database: "hustle_staging",
  authBaseUrl: "https://ep-square-sea-zax0gyud.neonauth.c-2.eu-west-2.aws.neon.tech/hustle_staging/auth",
  jwksUrl: "https://ep-square-sea-zax0gyud.neonauth.c-2.eu-west-2.aws.neon.tech/hustle_staging/auth/.well-known/jwks.json",
  databaseHosts: [
    "ep-square-sea-zax0gyud.c-2.eu-west-2.aws.neon.tech",
    "ep-square-sea-zax0gyud-pooler.c-2.eu-west-2.aws.neon.tech"
  ]
});

export function validateIsolatedStagingConfiguration(env) {
  if (env.HUSTLE_RUNTIME_SCOPE !== "isolated-staging" ||
      env.HUSTLE_AUTH_PROVIDER !== "neon-managed") {
    throw new Error("Isolated staging must be explicitly selected");
  }
  if (env.HUSTLE_STAGING_PROJECT_ID !== STAGING_IDENTITY.projectId ||
      env.NEON_AUTH_BASE_URL !== STAGING_IDENTITY.authBaseUrl ||
      env.NEON_AUTH_JWKS_URL !== STAGING_IDENTITY.jwksUrl) {
    throw new Error("Wrong staging project or authentication issuer");
  }
  if (env.SUPABASE_URL || env.SUPABASE_PUBLISHABLE_KEY ||
      env.SUPABASE_SERVICE_ROLE_KEY || env.PAYSTACK_SECRET_KEY ||
      env.MONNIFY_API_KEY || env.EXPO_TOKEN || env.VERCEL_TOKEN) {
    throw new Error("Existing app/provider credentials are forbidden in isolated staging");
  }
  if (env.EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS !== "false" ||
      env.HUSTLE_FINANCIAL_PROVIDERS_ENABLED !== "false") {
    throw new Error("Booking submission and financial providers must remain disabled");
  }
  let database;
  try { database = new URL(env.DATABASE_URL); }
  catch { throw new Error("Staging database URL is missing or malformed"); }
  if (!["postgresql:", "postgres:"].includes(database.protocol) ||
      !STAGING_IDENTITY.databaseHosts.includes(database.hostname) ||
      database.pathname !== "/hustle_staging" ||
      !["require", "verify-full"].includes(database.searchParams.get("sslmode"))) {
    throw new Error("Wrong staging database target or unsafe TLS configuration");
  }
  // Return only public, non-secret facts. Never return credentials.
  return { scope: "isolated-staging", projectId: STAGING_IDENTITY.projectId };
}
